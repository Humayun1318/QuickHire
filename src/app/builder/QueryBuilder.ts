import {
    FilterQuery,
    Model,
    Types,
} from "mongoose";


import {
    DEFAULT_LIMIT,
    DEFAULT_PAGE,
    FIELDS_QUERY_KEY,
    FilterConfig,
    LIMIT_QUERY_KEY, MAX_LIMIT,
    ModelQuery,
    PAGE_QUERY_KEY, PaginationMeta, QueryParams, SEARCH_QUERY_KEY,
    SORT_QUERY_KEY
} from "../shared/queryBuilder";


export class QueryBuilder<T> {

    private modelQuery: ModelQuery<T>;
    private model: Model<T>;
    private queryParams: QueryParams;
    private config: FilterConfig;
    private internalFilter: FilterQuery<T> = {};
    private page = DEFAULT_PAGE;
    private limit = DEFAULT_LIMIT;
    private skip = 0;

    constructor(
        model: Model<T>,
        modelQuery: ModelQuery<T>,
        queryParams: QueryParams,
        config: FilterConfig
    ) {
        this.model = model;
        this.modelQuery = modelQuery;
        this.queryParams = queryParams;
        this.config = config;

        this.limit =
            config.defaultLimit ?? DEFAULT_LIMIT;
    }
    /* ============================================================
                                Helpers
    ============================================================ */
    /**
         * Get string query parameter
         * Example:
         * search="  react  "
         *
         * =>
         *
         * "react"
    */
    private getString(
        key: string
    ): string {
        const value =
            this.queryParams[key];

        return typeof value === "string"
            ? value.trim()
            : "";
    }
    /**
         * Convert query value into number
         * Example:
         *
         * page="10"
         *
         * =>
         *
         * 10
    */
    private getNumber(
        key: string
    ): number | undefined {
        const value =
            this.getString(key);

        if (!value) {
            return undefined;
        }
        const number =
            Number(value);

        if (Number.isNaN(number)) {
            return undefined;
        }
        return number;
    }
    /**
     * Convert query value into boolean
     * Example:
     *
     * isActive="true"
     *
     * =>
     *
     * true
     */
    private getBoolean(
        key: string
    ): boolean | undefined {
        const value =
            this.getString(key);
        if (value === "true") {
            return true;
        }
        if (value === "false") {
            return false;
        }
        return undefined;
    }
    /**
     * Convert comma separated string into array
     * Example:
     * skills=React,Node,Express
     * =>
     * ["React","Node","Express"]
     */
    private getArray(
        key: string
    ): string[] {
        const value =
            this.getString(key);

        if (!value) {
            return [];
        }
        return value
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }
    /**
     * Merge filter and apply mongoose query
     * Example:
     * {
     *   status:"active"
     * }
     * =>
     * MongoDB filter
     */
    private addFilter(
        filter: FilterQuery<T>
    ) {
        this.internalFilter = {
            ...this.internalFilter,
            ...filter,
        };

        this.modelQuery =
            this.modelQuery.find(
                this.internalFilter
            );
    }
    /* ============================================================
                                Search
     ============================================================ */
    /**
         * Search keyword from searchable fields
         * Example:
         * search=john
         * =>
         * {
         *   name: /john/i,
         *   email: /john/i
         * }
    */
    search() {
        const keyword =
            this.getString(SEARCH_QUERY_KEY);
        if (!keyword) {
            return this;
        }

        const searchableFields =
            this.config.searchableFields ?? [];
        if (!searchableFields.length) {
            return this;
        }

        const conditions =
            searchableFields.map(field => ({
                [field]: {
                    $regex: keyword,
                    $options: "i",
                },
            } as FilterQuery<T>));

        this.addFilter({
            $or: conditions,
        });
        return this;
    }
    /* ============================================================
                                Filter
    ============================================================ */
    /**
     * Filter data based on configured fields
     * Supported:
     *
     * - Boolean
     * - Array
     * - ObjectId
     * - Enum
     * - String
     */
    filter() {

        const filterableFields =
            this.config.filterableFields ?? [];

        const booleanFields =
            new Set(
                this.config.booleanFields ?? []
            );
        const objectIdFields =
            new Set(
                this.config.objectIdFields ?? []
            );
        const arrayFields =
            new Set(
                this.config.arrayFields ?? []
            );
        const enumFields =
            new Set(
                this.config.enumFields ?? []
            );

        const filters:
            Record<string, unknown> = {};

        for (const field of filterableFields) {
            const value =
                this.getString(field);

            if (!value) {
                continue;
            }
            /**
             * Example:
             * isActive=true
             * =>
             *
             * { isActive:true }
             */
            if (booleanFields.has(field)) {
                const boolValue =
                    this.getBoolean(field);
                if (boolValue !== undefined) {
                    filters[field] =
                        boolValue;
                }
                continue;
            }
            /**
             * Example:
             * role=ADMIN,HR
             * =>
             * {
             *   role:{
             *      $in:["ADMIN","HR"]
             *   }
             * }
             */
            if (arrayFields.has(field)) {
                const values =
                    this.getArray(field);

                if (values.length) {
                    filters[field] = {
                        $in: values,
                    };
                }
                continue;
            }
            /**
             * Example:
             * userId=64abc...
             * =>
             * ObjectId("64abc...")
             */
            if (objectIdFields.has(field)) {
                if (
                    Types.ObjectId.isValid(value)
                ) {
                    filters[field] =
                        new Types.ObjectId(value);
                }
                continue;
            }
            /**
             * Example:
             * status=ACTIVE
             * =>
             * {
             *   status:"ACTIVE"
             * }
             */
            if (enumFields.has(field)) {
                filters[field] =
                    value;
                continue;
            }
            // normal string or nested field
            filters[field] =
                value;
        }
        if (
            Object.keys(filters).length
        ) {
            this.addFilter(filters);
        }
        return this;
    }
    /* ============================================================
                                Range
    ============================================================ */
    /**
     * Filter data within numeric range
     * Example:
     * minSalary=5000
     * maxSalary=10000
     * =>
     * {
     *   salary:{
     *      $gte:5000,
     *      $lte:10000
     *   }
     * }
     */
    range() {
        const ranges =
            this.config.rangeFields ?? [];

        const filters:
            Record<string, unknown> = {};

        for (const range of ranges) {
            const fieldName =
                range.field.charAt(0).toUpperCase() +
                range.field.slice(1);
            const min =
                this.getNumber(
                    range.minKey ?? `min${fieldName}`
                );
            const max =
                this.getNumber(
                    range.maxKey ?? `max${fieldName}`
                );
            if (
                min === undefined &&
                max === undefined
            ) {
                continue;
            }
            const condition:
                Record<string, number> = {};

            if (min !== undefined) {
                condition.$gte = min;
            }

            if (max !== undefined) {
                condition.$lte = max;
            }

            filters[range.field] =
                condition;
        }

        if (Object.keys(filters).length) {
            this.addFilter(filters);
        }
        return this;
    }
    /* ============================================================
                                Sort
    ============================================================ */
    /**
     * Sort data by allowed fields
     * Example:
     * sort=-createdAt,name
     * =>
     * {
     *   createdAt:-1,
     *   name:1
     * }
     */
    sort() {

        const sortableFields =
            this.config.sortableFields ?? [];

        const sort =
            this.getString(SORT_QUERY_KEY);

        if (!sort) {
            if (this.config.defaultSort) {
                this.modelQuery =
                    this.modelQuery.sort(
                        this.config.defaultSort
                    );
            }
            return this;
        }

        const sorts =
            sort
                .split(",")
                .map(item => item.trim())
                .filter(Boolean);

        const validSorts =
            sorts.filter(item => {
                const field =
                    item.startsWith("-")
                        ? item.slice(1)
                        : item;
                return sortableFields.includes(field);
            });

        if (validSorts.length) {
            this.modelQuery =
                this.modelQuery.sort(
                    validSorts.join(" ")
                );
        }
        return this;
    }
    /* ============================================================
                                Pagination
    ============================================================ */
    /**
     * Apply pagination
     * Example:
     * page=2&limit=10
     *
     * =>
     *
     * skip=10
     * limit=10
     */
    paginate() {
        const page =
            this.getNumber(PAGE_QUERY_KEY);
        const limit =
            this.getNumber(LIMIT_QUERY_KEY);
        this.page =
            page && page > 0
                ? page
                : DEFAULT_PAGE;

        this.limit =
            limit && limit > 0
                ? Math.min(
                    limit,
                    this.config.maxLimit ?? MAX_LIMIT
                )
                : this.config.defaultLimit ??
                DEFAULT_LIMIT;

        this.skip =
            (this.page - 1) *
            this.limit;

        this.modelQuery =
            this.modelQuery
                .skip(this.skip)
                .limit(this.limit);

        return this;
    }
    /* ============================================================
                                Select Fields
    ============================================================ */
    /**
     * Select allowed fields
     * Example:
     * fields=name,email
     * =>
     * {
     *   name:1,
     *   email:1
     * }
     */
    fields() {
        const selectableFields =
            this.config.selectableFields ?? [];

        const fields =
            this.getString(FIELDS_QUERY_KEY);

        if (!fields) {
            return this;
        }
        const selected =
            fields
                .split(",")
                .map(item => item.trim())
                .filter(Boolean);
        const validFields =
            selected.filter(field =>
                selectableFields.includes(field)
            );

        if (validFields.length) {
            this.modelQuery =
                this.modelQuery.select(
                    validFields.join(" ")
                );
        }
        return this;
    }
    /* ============================================================
                                Populate
    ============================================================ */
    /**
     * Populate mongoose references
     * Example:
     * populate:user
     * =>
     * User document attached
     */
    populate() {
        const populates =
            this.config.populate ?? [];
        if (!populates.length) {
            return this;
        }

        for (const populate of populates) {
            this.modelQuery =
                this.modelQuery.populate(populate);
        }
        return this;
    }
    /* ============================================================
                                Lean
    ============================================================ */
    /**
     * Convert mongoose document into plain object
     * Example:
     * Document
     * =>
     * Plain Object
     */
    lean(
        enable = true
    ) {
        if (enable) {
            this.modelQuery =
                this.modelQuery.lean();
        }
        return this;
    }
    /* ============================================================
                                Meta
    ============================================================ */
    /**
     * Generate pagination metadata
     * Example:
     * total=100
     * limit=10
     * =>
     * totalPages=10
     */
    async getMeta(): Promise<PaginationMeta> {
        const total =
            await this.model.countDocuments(
                this.internalFilter
            );

        const totalPages =
            Math.ceil(
                total / this.limit
            );

        return {
            page: this.page,
            limit: this.limit,
            skip: this.skip,
            total,
            totalPages,
            hasNextPage:
                this.page < totalPages,
            hasPreviousPage:
                this.page > 1,
            nextPage:
                this.page < totalPages
                    ? this.page + 1
                    : null,
            previousPage:
                this.page > 1
                    ? this.page - 1
                    : null,
        };
    }
    /* ============================================================
                                Execute
    ============================================================ */
    /**
     * Execute query and return data with meta
     * Example:
     * {
     *   meta:{},
     *   data:[]
     * }
     */
    async execute() {
        const [data, meta] =
            await Promise.all([
                this.modelQuery,
                this.getMeta(),
            ]);
        return {
            meta,
            data,
        };
    }
}