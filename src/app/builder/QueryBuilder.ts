import {
    FilterQuery,
    PopulateOptions,
    Types,
} from "mongoose";

import {
    DEFAULT_LIMIT,
    DEFAULT_PAGE,
    MAX_LIMIT,
    RESERVED_QUERY_FIELDS,
} from "./query.constants";

import {
    FilterConfig,
    ModelQuery,
    PaginationMeta,
    QueryParams,
    RangeFilterConfig,
} from "./query.types";

export class QueryBuilder<T> {

    private baseQuery: ModelQuery<T>;
    private modelQuery: ModelQuery<T>;
    private queryParams: QueryParams;
    private config: FilterConfig;
    private internalFilter: FilterQuery<T> = {};
    private page = DEFAULT_PAGE;
    private limit = DEFAULT_LIMIT;
    private skip = 0;

    constructor(
        modelQuery: ModelQuery<T>,
        queryParams: QueryParams,
        config: FilterConfig
    ) {
        this.baseQuery = modelQuery;
        this.modelQuery = modelQuery;
        this.queryParams = queryParams;
        this.config = config;

        this.limit =
            config.defaultLimit ?? DEFAULT_LIMIT;
    }

    private getString(key: string): string {
        const value = this.queryParams[key];
        return typeof value === "string"
            ? value.trim()
            : "";
    }

    private getNumber(key: string): number | undefined {

        const value = this.getString(key);
        if (!value) return undefined;

        const number = Number(value);

        if (Number.isNaN(number)) {
            return undefined;
        }
        return number;
    }

    private getBoolean(
        key: string
    ): boolean | undefined {

        const value = this.getString(key);
        if (!value) return undefined;

        if (value === "true") return true;
        if (value === "false") return false;

        return undefined;
    }

    private getArray(key: string): string[] {

        const value = this.getString(key);
        if (!value) return [];

        return value
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    private addFilter(
        filter: FilterQuery<T>
    ) {
        this.internalFilter = {
            ...this.internalFilter,
            ...filter,
        };
        this.modelQuery =
            this.modelQuery.find(filter);
    }


    // search for keyword in searchable fields
    search() {
        const keyword = this.getString("search");

        if (!keyword) {
            return this;
        }

        const searchableFields =
            this.config.searchableFields ?? [];

        if (!searchableFields.length) {
            return this;
        }

        const conditions: FilterQuery<T>[] = [];

        for (const field of searchableFields) {
            conditions.push({
                [field]: {
                    $regex: keyword,
                    $options: "i",
                },
            } as FilterQuery<T>);
        }

        this.addFilter({
            $or: conditions,
        });
        return this;
    }

    // filter based on filterable fields
    filter() {
        const filterableFields =
            this.config.filterableFields ?? [];

        const booleanFields = new Set(
            this.config.booleanFields ?? []
        );

        const objectIdFields = new Set(
            this.config.objectIdFields ?? []
        );

        const arrayFields = new Set(
            this.config.arrayFields ?? []
        );

        const enumFields = new Set(
            this.config.enumFields ?? []
        );

        const filters: Record<string, unknown> = {};

        for (const field of filterableFields) {
            const value = this.getString(field);

            if (!value) {
                continue;
            }

            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                continue;
            }
            /**
             * Boolean
             */

            if (booleanFields.has(field)) {

                const boolValue =
                    this.getBoolean(field);

                if (boolValue !== undefined) {

                    filters[field] = boolValue;

                }

                continue;
            }

            /**
             * Array ($in)
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
             * ObjectId
             */

            if (objectIdFields.has(field)) {

                const id =
                    this.getString(field);

                if (Types.ObjectId.isValid(id)) {
                    filters[field] = new Types.ObjectId(id);
                }
                continue;
            }

            /**
             * Enum
             */

            if (enumFields.has(field)) {

                const enumValue =
                    this.getString(field);

                if (enumValue) {
                    filters[field] = enumValue;
                }

                continue;
            }

            /**
             * Normal String / Nested Field
             *
             * Example:
             *
             * address.city
             * address.country
             */

            filters[field] = value;

        }

        if (Object.keys(filters).length) {
            this.addFilter(filters);
        }

        return this;

    }

    //range filter based on range able fields
    range() {
        const ranges =
            this.config.rangeFields ?? [];

        const filters: Record<
            string,
            unknown
        > = {};

        for (const range of ranges) {
            const min =
                this.getNumber(
                    range.minKey ?? `min${range.field}`
                );

            const max =
                this.getNumber(
                    range.maxKey ?? `max${range.field}`
                );

            if (
                min === undefined &&
                max === undefined
            ) {
                continue;
            }

            filters[range.field] = {};

            if (min !== undefined) {
                filters[range.field] = {
                    ...filters[range.field] as object,
                    $gte: min,
                };
            }

            if (max !== undefined) {
                filters[range.field] = {
                    ...filters[range.field] as object,
                    $lte: max,
                };
            }
        }

        if (Object.keys(filters).length) {
            this.addFilter(filters);
        }
        return this;
    }

    // sort based on sortable fields
    sort() {
        const sortableFields =
            this.config.sortableFields ?? [];

        const sort =
            this.getString("sort");

        if (!sort) {
            if (this.config.defaultSort) {
                this.modelQuery =
                    this.modelQuery.sort(
                        this.config.defaultSort
                    );
            }
            return this;
        }

        const sorts = sort
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

    //paginate based on page and limit
    paginate() {
        const page =
            this.getNumber("page");

        const limit =
            this.getNumber("limit");

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
            (this.page - 1) * this.limit;

        this.modelQuery =
            this.modelQuery
                .skip(this.skip)
                .limit(this.limit);
        return this;
    }

    // select fields based on selectable fields
    fields() {

        const selectableFields =
            this.config.selectableFields ?? [];

        const fields =
            this.getString("fields");

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

    // populate fields based on populate options
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

    // enable lean query
    lean(enable = true) {
        if (enable) {
            this.modelQuery =
                this.modelQuery.lean();
        }
        return this;
    }

    // get meta information about the query (pagination, total count, etc.)
    async getMeta(): Promise<PaginationMeta> {

        const total =
            await this.baseQuery
                .model
                .countDocuments(
                    this.internalFilter
                );

        const totalPages =
            Math.ceil(total / this.limit);

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