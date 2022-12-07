var RefModule = (function (exports) {
    'use strict';

    var ListenerContainer = function ListenerContainer() {
        this.listenerMap = new Map();
        this.listeners = [];
    };
    ListenerContainer.prototype.addListener = function addListener (listener, target) {
            if ( target === void 0 ) target = this;

        if (this.listenerMap.get(listener)) {
            return undefined;
        }
        var data = {
            target: target,
            listener: listener,
            once: false,
        };
        this.listeners.push(data);
        this.listenerMap.set(listener, data);
        return listener;
    };
    ListenerContainer.prototype.addOnceListener = function addOnceListener (listener, target) {
            if ( target === void 0 ) target = this;

        if (this.listenerMap.get(listener)) {
            return undefined;
        }
        var data = {
            target: target,
            listener: listener,
            once: true,
        };
        this.listeners.push(data);
        this.listenerMap.set(listener, data);
        return listener;
    };
    ListenerContainer.prototype.removeListener = function removeListener (listener) {
            var this$1 = this;

        this.listeners.forEach(function (data, i) {
            if ((data === null || data === void 0 ? void 0 : data.listener) == listener)
                { this$1.mark(data.listener, i); }
        });
        this.clearMark();
    };
    ListenerContainer.prototype.removeAllListener = function removeAllListener (target) {
            var this$1 = this;

        this.listeners.forEach(function (data, i) {
            if ((data === null || data === void 0 ? void 0 : data.target) == target)
                { this$1.mark(data.listener, i); }
        });
        this.clearMark();
    };
    ListenerContainer.prototype.dispatch = function dispatch () {
            var ref;

            var args = [], len = arguments.length;
            while ( len-- ) args[ len ] = arguments[ len ];
        return (ref = this).dispatchIgnoreTarget.apply(ref, [ null ].concat( args ));
    };
    ListenerContainer.prototype.dispatchIgnoreTarget = function dispatchIgnoreTarget (target) {
            var this$1 = this;
            var args = [], len = arguments.length - 1;
            while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

        if (this.listeners.length == 0)
            { return; }
        var results = [];
        this.listeners.forEach(function (data, i) {
            try {
                if (target == (data === null || data === void 0 ? void 0 : data.target))
                    { return; }
                results.push(data.listener.apply(data.target, args));
            }
            catch (e) {
                this$1.mark(data.listener, i);
                console.error(e, data);
            }
            if (data.once)
                { this$1.mark(data.listener, i); }
        });
        this.clearMark();
        return Promise.all(results);
    };
    ListenerContainer.prototype.count = function count () {
        return this.listeners.length;
    };
    ListenerContainer.prototype.clear = function clear () {
        this.listeners.length = 0;
        this.listenerMap.clear();
    };
    ListenerContainer.prototype.mark = function mark (listener, index) {
        this.listeners[index] = undefined;
        this.listenerMap.delete(listener);
    };
    ListenerContainer.prototype.clearMark = function clearMark () {
        this.listeners = this.listeners.filter(function (data) { return data; });
    };

    var refDependMap = new Map();
    var scopeMap = new Map();
    var computeRefQueue = [];
    var scopeQueue = [];
    var txRefs = [];
    var __clear = '__c';
    var __notify = '__n';
    var currentScope = {};
    var cleaning = false;
    var transaction = false;
    function listen(ref, scope) {
        scope = getScope(scope);
        getRefScope(scope).listenRefs.push(ref);
        return scope;
    }
    function clearDepend(ref) {
        if (cleaning)
            { return; }
        if (transaction) {
            txRefs.push(ref);
            return;
        }
        doClearDepend(scanRef(ref));
    }
    function clearDepends() {
        if (cleaning)
            { return; }
        var refMap = new Map();
        txRefs.forEach(function (ref) { return scanRef(ref, refMap); });
        doClearDepend(refMap);
        txRefs.length = 0;
    }
    function doClearDepend(refMap) {
        if (refMap.size == 0)
            { return; }
        cleaning = true;
        refMap.forEach(function (r) { return r[__clear](); });
        refMap.forEach(function (r) { return r[__notify](); });
        cleaning = false;
    }
    function scanRef(ref, collection) {
        if ( collection === void 0 ) collection = new Map();

        var map = refDependMap.get(ref);
        if (map) {
            map.forEach(function (r) {
                if (collection.get(r))
                    { return; }
                collection.set(r, r);
                scanRef(r, collection);
            });
            map.clear();
        }
        return collection;
    }
    function addDepend(ref) {
        var currentRef = computeRefQueue[computeRefQueue.length - 1];
        if (currentRef) {
            if (currentRef == ref)
                { return; }
            var refMap = computeIfAbsent(refDependMap, ref, function (k) {
                return new Map();
            });
            refMap.set(currentRef, currentRef);
            getRefScope(currentRef.getScope()).refMap.set(currentRef, refMap);
        }
    }
    function getScope(scope) {
        return scope || currentScope;
    }
    function getRefScope(scope) {
        return computeIfAbsent(scopeMap, scope, function (k) {
            return {
                listenRefs: [],
                refMap: new Map()
            };
        });
    }
    function computeIfAbsent(map, key, callable) {
        var value = map.get(key);
        if (value == undefined) {
            map.set(key, (value = callable(key)));
        }
        return value;
    }
    var Refs = function Refs() {
        this.localStorage = { getItem: function getItem(key) { return null; }, setItem: function setItem(key, value) { } };
        this.sessionStorage = { getItem: function getItem(key) { return null; }, setItem: function setItem(key, value) { } };
    };
    /**
     *
     * @param value
     * @param scope
     * @param operators Settable operator.
     * @returns RefValue
     */
    Refs.prototype.of = function of (value, scope, operators) {
        return new RefValue(getScope(scope), value, operators);
    };
    Refs.prototype.ofComputed = function ofComputed (provider, scope) {
        return new RefComputed(getScope(scope), provider);
    };
    /**
     * Create cacheable Ref.
     */
    Refs.prototype.ofCache = function ofCache (config, scope, operators) {
        var storage = config.local ? this.localStorage : this.sessionStorage;
        var value;
        var cache = storage.getItem(config.name);
        if (cache) {
            try {
                value = JSON.parse(cache);
            }
            catch (e) {
                console.warn(e);
            }
        }
        if (value == undefined) {
            value = config.value;
        }
        var ref = this.of(value, scope, operators);
        ref.listen(function () {
            storage.setItem(config.name, ref.stringify());
        });
        return ref;
    };
    /**
     * Operate any ref in scope.
     */
    Refs.prototype.runInScope = function runInScope (runnable, scope) {
        try {
            scopeQueue.push(currentScope);
            currentScope = scope;
            runnable();
        }
        finally {
            currentScope = scopeQueue.pop();
        }
    };
    /**
     * Remove all dependencies and listener by scope.
     */
    Refs.prototype.off = function off (scope) {
        var scopeContext = scopeMap.get(scope);
        if (scopeContext) {
            scopeContext.refMap.forEach(function (map, ref) {
                map.delete(ref);
            });
            scopeContext.listenRefs.forEach(function (ref) {
                ref.interrupt(scope);
            });
            scopeContext.listenRefs.length = 0;
            scopeContext.refMap.clear();
            scopeMap.delete(scope);
        }
    };
    Refs.prototype.setLocalStorage = function setLocalStorage (storage) {
        this.localStorage = storage;
    };
    Refs.prototype.setSessionStorage = function setSessionStorage (storage) {
        this.sessionStorage = storage;
    };
    /**
     * Post notifications after processing all value updates.
     */
    Refs.prototype.tx = function tx (runnable) {
        transaction = true;
        try {
            runnable();
        }
        finally {
            transaction = false;
            clearDepends();
        }
    };
    var Ref = function Ref(scope) {
        this.scope = scope;
        this.listeners = new ListenerContainer();
    };
    Ref.prototype.stringify = function stringify () {
        return this.valueStringify;
    };
    Ref.prototype.getScope = function getScope () {
        return this.scope;
    };
    Ref.prototype.listen = function listen$1 (listener, scope) {
        scope = listen(this, scope);
        listener(this.get(), this.oldValue);
        this.listeners.addListener(listener, scope);
    };
    Ref.prototype.interrupt = function interrupt (scope) {
        this.listeners.removeAllListener(scope);
    };
    Ref.prototype.setValue = function setValue (value) {
        if (this.doSetValue(value)) {
            clearDepend(this);
            this.listeners.dispatch(this.value);
        }
    };
    Ref.prototype.doSetValue = function doSetValue (value) {
        var stringify = JSON.stringify(value);
        if (this.valueStringify === stringify)
            { return false; }
        this.oldValue = this.value;
        this.value = value;
        this.valueStringify = stringify;
        return true;
    };
    var RefValue = /*@__PURE__*/(function (Ref) {
        function RefValue(scope, provider, /** settable operator */ operators) {
            Ref.call(this, scope);
            this.provider = provider;
            this.operators = operators;
            this.doSetValue(provider);
        }

        if ( Ref ) RefValue.__proto__ = Ref;
        RefValue.prototype = Object.create( Ref && Ref.prototype );
        RefValue.prototype.constructor = RefValue;
        RefValue.prototype.get = function get () {
            addDepend(this);
            return this.value;
        };
        RefValue.prototype.clear = function clear () {
            this.set(this.provider);
        };
        RefValue.prototype.set = function set (value, operator) {
            var _a;
            if ((((_a = this.operators) === null || _a === void 0 ? void 0 : _a.length) || 0) > 0 && this.operators.indexOf(operator) == -1) {
                console.error('The operator does\'t settable!', operator);
                throw new Error('The operator does\'t settable!');
            }
            this.setValue(value);
        };

        return RefValue;
    }(Ref));
    var RefComputed = /*@__PURE__*/(function (Ref) {
        function RefComputed(scope, provider) {
            var this$1 = this;

            Ref.call(this, scope);
            this.provider = provider;
            this.dirty = false;
            this[__clear] = function () {
                this$1.valueStringify = undefined;
                this$1.dirty = false;
            };
            this[__notify] = function () {
                if (this$1.listeners.count() == 0)
                    { return; }
                this$1.get(true);
            };
        }

        if ( Ref ) RefComputed.__proto__ = Ref;
        RefComputed.prototype = Object.create( Ref && Ref.prototype );
        RefComputed.prototype.constructor = RefComputed;
        RefComputed.prototype.setValue = function setValue (value) {
            if (this.doSetValue(value)) {
                if (this.dirty) {
                    clearDepend(this);
                }
                this.listeners.dispatch(this.value);
                this.dirty = true;
            }
        };
        RefComputed.prototype.get = function get (force) {
            if ( force === void 0 ) force = false;

            addDepend(this);
            if (this.valueStringify == undefined || force) {
                var value;
                try {
                    computeRefQueue.push(this);
                    value = this.provider();
                }
                finally {
                    computeRefQueue.pop();
                }
                this.setValue(value);
            }
            return this.value;
        };

        return RefComputed;
    }(Ref));

    exports.Ref = Ref;
    exports.RefComputed = RefComputed;
    exports.RefValue = RefValue;
    exports.default = Refs;

    return exports;

}({}));
