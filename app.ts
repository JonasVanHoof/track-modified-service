import { app, sparqlEscapeUri, sparqlEscapeDateTime } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';

import { ErrorRequestHandler, Request, Response } from 'express';
import { Changeset } from './types';
import {
  filterDeltas,
  filterModifiedSubjects,
  interestingTypes,
} from './config/config';
import bodyParser from 'body-parser';

app.use(
  bodyParser.json({
    limit: '500mb',
    type: function (req: Request) {
      return /^application\/json/.test(req.get('content-type') as string);
    },
  }),
);

const interestingTypesSet = new Set(interestingTypes);

async function fetchSubjectTypes(subjects: string[]) {
  if (interestingTypes.length === 0) {
    return subjects;
  }
  const result = await query(`
    SELECT DISTINCT ?subject ?type WHERE {
      ?subject a ?type .
      VALUES ?subject { ${subjects.map(sparqlEscapeUri).join(' ')} }
    }`);

  return result.results.bindings.map((binding) => {
    return {
      uri: binding.subject.value as string,
      type: binding.type.value as string,
    };
  });
}

async function handleChangedSubjects(subjects: string[]) {
  const subjectTypes = await fetchSubjectTypes(subjects);
  const subjectsWithInterestingTypes = subjectTypes.filter((subject) => {
    return interestingTypesSet.has(subject.type);
  });

  if (subjectsWithInterestingTypes.length == 0) {
    return;
  }

  const subjectsAndTypesValues = subjectsWithInterestingTypes
    .map((subject) => {
      return `(${sparqlEscapeUri(subject.uri)} ${sparqlEscapeUri(
        subject.type,
      )})`;
    })
    .join('\n');

  update(`
    PREFIX dct: <http://purl.org/dc/terms/>

    DELETE {
      GRAPH ?g {
        ?subject dct:modified ?modified .
      }
    }
    INSERT {
      GRAPH ?g {
        ?subject dct:modified ${sparqlEscapeDateTime(new Date())} .
      }
    }
    WHERE {
      GRAPH ?g {
        ?subject a ?type .
        VALUES (?subject ?type) {
          ${subjectsAndTypesValues}
        }
        OPTIONAL { ?subject dct:modified ?modified }
      }
      ${filterModifiedSubjects}
    }
  `);
}

async function handleDelta(req: Request, res: Response) {
  console.log('incoming delta');
  const changeSets: Changeset[] = req.body;
  const filteredChangeSets = await filterDeltas(changeSets);
  const subjects = new Set<string>();
  filteredChangeSets.forEach(async (changeSet) => {
    changeSet.inserts.forEach((quad) => subjects.add(quad.subject.value));
    changeSet.deletes.forEach((quad) => subjects.add(quad.subject.value));
  });
  await handleChangedSubjects([...subjects]);
  console.log('handled delta');

  res.status(201).send();
}

app.post('/delta', handleDelta);

const errorHandler: ErrorRequestHandler = function (err, _req, res, _next) {
  // custom error handler to have a default 500 error code instead of 400 as in the template
  res.status(err.status || 500);
  res.json({
    errors: [{ title: err.message }],
  });
};

app.use(errorHandler);
