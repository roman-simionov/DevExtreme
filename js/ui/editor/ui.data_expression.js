"use strict";

var $ = require("../../core/renderer"),
    variableWrapper = require("../../core/utils/variable_wrapper"),
    dataCoreUtils = require("../../core/utils/data"),
    commonUtils = require("../../core/utils/common"),
    typeUtils = require("../../core/utils/type"),
    extend = require("../../core/utils/extend").extend,
    FunctionTemplate = require("../widget/function_template"),
    DataHelperMixin = require("../../data_helper"),
    DataSourceModule = require("../../data/data_source/data_source"),
    ArrayStore = require("../../data/array_store");

/**
* @name DataExpressionMixin
* @publicName DataExpressionMixin
* @module ui/editor/ui.data_expression
* @inherits DataHelperMixin
* @export default
* @hidden
*/
var DataExpressionMixin = extend(DataHelperMixin, {

    _dataExpressionDefaultOptions: function() {
        return {
            /**
            * @name DataExpressionMixinOptions_items
            * @publicName items
            * @type array
            */
            items: [],

            /**
            * @name DataExpressionMixinOptions_dataSource
            * @publicName dataSource
            * @type string|array|DataSource|DataSource configuration
            * @default null
            */
            dataSource: null,

            /**
            * @name DataExpressionMixinOptions_itemTemplate
            * @publicName itemTemplate
            * @type template
            * @default "item"
            * @type_function_param1 itemData:object
            * @type_function_param2 itemIndex:number
            * @type_function_param3 itemElement:jQuery
            * @type_function_return string|Node|jQuery
            */
            itemTemplate: "item",

            /**
            * @name DataExpressionMixinOptions_value
            * @publicName value
            * @type any
            * @default null
            */
            value: null,

            /**
            * @name DataExpressionMixinOptions_valueExpr
            * @publicName valueExpr
            * @type string|function
            * @default "this"
            */
            valueExpr: "this",

            /**
            * @name DataExpressionMixinOptions_displayExpr
            * @publicName displayExpr
            * @type string|function
            * @default undefined
            */
            displayExpr: undefined
        };
    },

    _initDataExpressions: function() {
        this._compileValueGetter();
        this._compileDisplayGetter();
        this._initDynamicTemplates();
        this._initDataSource();
        this._itemsToDataSource();
    },

    _itemsToDataSource: function() {
        if(!this.option("dataSource")) {
            // TODO: try this.option("dataSource", new ...)
            this._dataSource = new DataSourceModule.DataSource({
                store: new ArrayStore(this.option("items")),
                pageSize: 0
            });
        }
    },

    _compileDisplayGetter: function() {
        this._displayGetter = dataCoreUtils.compileGetter(this._displayGetterExpr());
    },

    _displayGetterExpr: function() {
        return this.option("displayExpr");
    },

    _compileValueGetter: function() {
        this._valueGetter = dataCoreUtils.compileGetter(this._valueGetterExpr());
    },

    _valueGetterExpr: function() {
        return this.option("valueExpr") || "this";
    },

    _loadValue: function(value) {
        var deferred = $.Deferred();
        value = this._unwrappedValue(value);

        if(!typeUtils.isDefined(value)) {
            return deferred.reject().promise();
        }

        this._loadSingle(this._valueGetterExpr(), value)
            .done((function(item) {
                this._isValueEquals(this._valueGetter(item), value)
                    ? deferred.resolve(item)
                    : deferred.reject();
            }).bind(this))
            .fail(function() {
                deferred.reject();
            });

        return deferred.promise();
    },

    _getCurrentValue: function() {
        return this.option("value");
    },

    _unwrappedValue: function(value) {
        value = typeUtils.isDefined(value) ? value : this._getCurrentValue();

        if(value && this._dataSource && this._valueGetterExpr() === "this") {
            value = this._getItemKey(value);
        }

        return variableWrapper.unwrap(value);
    },

    _getItemKey: function(value) {
        var key = this._dataSource.key();

        if(Array.isArray(key)) {
            var result = {};
            for(var i = 0, n = key.length; i < n; i++) {
                result[key[i]] = value[key[i]];
            }
            return result;
        }

        if(key && typeof value === "object") {
            value = value[key];
        }

        return value;
    },

    _isValueEquals: function(value1, value2) {
        var dataSourceKey = this._dataSource && this._dataSource.key();

        var isDefined = typeUtils.isDefined;
        var result = this._compareValues(value1, value2);

        if(!result && dataSourceKey && isDefined(value1) && isDefined(value2)) {
            if(Array.isArray(dataSourceKey)) {
                result = this._compareByCompositeKey(value1, value2, dataSourceKey);
            } else {
                result = this._compareByKey(value1, value2, dataSourceKey);
            }
        }

        return result;
    },

    _compareByCompositeKey: function(value1, value2, key) {
        var isObject = typeUtils.isObject;

        if(!isObject(value1) || !isObject(value2)) {
            return false;
        }

        for(var i = 0, n = key.length; i < n; i++) {
            if(value1[key[i]] !== value2[key[i]]) {
                return false;
            }
        }

        return true;
    },

    _compareByKey: function(value1, value2, key) {
        var ensureDefined = commonUtils.ensureDefined;
        var unwrapObservable = variableWrapper.unwrap;
        var valueKey1 = ensureDefined(unwrapObservable(value1[key]), value1);
        var valueKey2 = ensureDefined(unwrapObservable(value2[key]), value2);

        return this._compareValues(valueKey1, valueKey2);
    },

    _compareValues: function(value1, value2) {
        return dataCoreUtils.toComparable(value1, true) === dataCoreUtils.toComparable(value2, true);
    },

    _initDynamicTemplates: function() {
        if(this._displayGetterExpr()) {
            this._originalItemTemplate = this._defaultTemplates["item"];
            this._defaultTemplates["item"] = new FunctionTemplate((function(options) {
                return $('<div/>').text(this._displayGetter(options.model)).html();
            }).bind(this));
        } else if(this._originalItemTemplate) {
            this._defaultTemplates["item"] = this._originalItemTemplate;
        }
    },

    _setCollectionWidgetItemTemplate: function() {
        this._initDynamicTemplates();
        this._setCollectionWidgetOption("itemTemplate", this._getTemplateByOption("itemTemplate"));
    },

    _dataExpressionOptionChanged: function(args) {
        switch(args.name) {
            case "items":
                this._itemsToDataSource();
                this._setCollectionWidgetOption("items");
                break;
            case "dataSource":
                this._initDataSource();
                break;
            case "itemTemplate":
                this._setCollectionWidgetItemTemplate();
                break;
            case "valueExpr":
                this._compileValueGetter();
                break;
            case "displayExpr":
                this._compileDisplayGetter();
                this._setCollectionWidgetItemTemplate();
                break;
        }
    }
});

/**
* @name DataExpressionMixinItemTemplate_disabled
* @publicName disabled
* @type boolean
* @default false
*/
/**
* @name DataExpressionMixinItemTemplate_visible
* @publicName visible
* @type boolean
* @default true
*/
/**
* @name DataExpressionMixinItemTemplate_template
* @publicName template
* @type template
*/

/**
* @name DataExpressionMixinItemTemplate_html
* @publicName html
* @type String
*/
/**
* @name DataExpressionMixinItemTemplate_text
* @publicName text
* @type String
*/

module.exports = DataExpressionMixin;
