import { FilterConfig } from '../../shared/queryBuilder';

export const jobCategoryBuilderConfig: FilterConfig = {
    searchableFields: [
        'name',
        'slug',
    ],

    filterableFields: [
        'isActive',
        'parentId',
        'depth',
    ],
    numberFields: [
        "depth",
        "jobCount",
    ],

    booleanFields: [
        'isActive',
    ],

    objectIdFields: [
        'parentId',
    ],
    

    rangeFields: [
        {
            field: 'depth',
            minKey: 'minDepth',
            maxKey: 'maxDepth',
        },
        {
            field: 'jobCount',
            minKey: 'minJobCount',
            maxKey: 'maxJobCount',
        },
    ],

    sortableFields: [
        'name',
        'depth',
        'jobCount',
        'createdAt',
        'updatedAt',
    ],

    defaultSort: 'name',

    selectableFields: [
        'name',
        'slug',
        'icon',
        'parentId',
        'depth',
        'jobCount',
        'isActive',
        'createdAt',
        'updatedAt',
    ],

    populate: [
        {
            path: 'parentId',
            select: 'name slug',
        },
    ],

    defaultLimit: 20,
    maxLimit: 100,
};