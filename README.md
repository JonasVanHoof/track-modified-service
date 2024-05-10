# Add Modified Service

Service that adds a dct:modified timestamp on a subject whenever a delta comes in for that subject.

The types for which a dct:modified is added can be configured in the json file located in the config directory.

The service can be configured using the following exports in the config folder (see included config for examples):

- **interestingTypes**: an array of types. The dct:modified will be set for Subjects with these types. If empty, all types will be considered.
- **filterModifiedSubjects**: an (optional) filter on the query of which subjects to update the modified for. The query contains ?subject, ?type, ?modified (current value, optional) and ?g as variables
- **filterDeltas**: a function that filters the deltas to act upon. By default, we won't change the modified for a subject if any delta triple (insert or delete) contains a modified for that subject.

> [!CAUTION]
> It is possible that we do not receive all deltas related to a change (if the change is split over multiple queries) and therefore might miss the modification date set by the application if it came in another batch of deltas. In that case the modified will still be updated. One can use batching in the delta notifier to mitigate this issue, but it will never completely go away.
