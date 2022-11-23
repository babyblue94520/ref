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
        cleaning = true;
        var refMap = scanRef(ref);
        refMap.forEach(function (v, r) {
            r.clear();
        });
        refMap.forEach(function (v, r) {
            r.get();
        });
        cleaning = false;
    }
    function clearDepends() {
        if (cleaning)
            { return; }
        cleaning = true;
        var refMap = new Map();
        txRefs.forEach(function (ref) {
            scanRef(ref, refMap);
        });
        refMap.forEach(function (v, r) {
            r.clear();
        });
        refMap.forEach(function (v, r) {
            r.get();
        });
        txRefs.length = 0;
        cleaning = false;
    }
    function scanRef(ref, collection) {
        if ( collection === void 0 ) collection = new Map();

        var map = refDependMap.get(ref);
        if (map) {
            var s = map.size;
            map.forEach(function (r) {
                collection.set(r, true);
                scanRef(r, collection);
            });
            map.clear();
        }
        return collection;
    }
    function addDepend(ref) {
        var currentRef = computeRefQueue[computeRefQueue.length - 1];
        if (currentRef) {
            if (currentRef == ref) {
                throw new Error('Doesn\'t depend self!');
            }
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
    Refs.prototype.ofCache = function ofCache (config, scope) {
        var storage = config.local ? this.localStorage : this.sessionStorage;
        var value = storage.getItem(config.name);
        if (value) {
            try {
                value = JSON.parse(value);
            }
            catch (e) {
                console.warn(e);
                value = undefined;
            }
        }
        if (value == undefined) {
            value = config.value;
        }
        return new RefCache(scope, value, function (str) {
            storage.setItem(config.name, str);
        });
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
        var stringify = JSON.stringify(value);
        if (this.valueStringify === stringify)
            { return false; }
        this.oldValue = this.value;
        this.value = value;
        this.valueStringify = stringify;
        return true;
    };
    Ref.prototype.dispatch = function dispatch () {
        clearDepend(this);
        this.listeners.dispatch(this.value);
    };
    var RefValue = /*@__PURE__*/(function (Ref) {
        function RefValue(scope, provider, /** settable operator */ operators) {
            Ref.call(this, scope);
            this.provider = provider;
            this.operators = operators;
            this.setValue(provider);
        }

        if ( Ref ) RefValue.__proto__ = Ref;
        RefValue.prototype = Object.create( Ref && Ref.prototype );
        RefValue.prototype.constructor = RefValue;
        RefValue.prototype.get = function get () {
            addDepend(this);
            return this.value;
        };
        RefValue.prototype.set = function set (value, operator) {
            var _a;
            if ((((_a = this.operators) === null || _a === void 0 ? void 0 : _a.length) || 0) > 0 && this.operators.indexOf(operator) == -1) {
                console.error('The operator does\'t settable!', operator);
                throw new Error('The operator does\'t settable!');
            }
            if (this.setValue(value)) {
                this.dispatch();
            }
        };
        RefValue.prototype.clear = function clear () {
            this.set(this.provider);
        };

        return RefValue;
    }(Ref));
    var RefComputed = /*@__PURE__*/(function (Ref) {
        function RefComputed(scope, provider) {
            Ref.call(this, scope);
            this.provider = provider;
        }

        if ( Ref ) RefComputed.__proto__ = Ref;
        RefComputed.prototype = Object.create( Ref && Ref.prototype );
        RefComputed.prototype.constructor = RefComputed;
        RefComputed.prototype.get = function get () {
            if (this.valueStringify == undefined) {
                try {
                    addDepend(this);
                    computeRefQueue.push(this);
                    this.setValue(this.provider());
                    this.dispatch();
                }
                finally {
                    computeRefQueue.pop();
                }
            }
            return this.value;
        };
        RefComputed.prototype.clear = function clear () {
            this.valueStringify = undefined;
        };

        return RefComputed;
    }(Ref));
    var RefCache = /*@__PURE__*/(function (RefValue) {
        function RefCache(scope, provider, save) {
            RefValue.call(this, scope, provider);
            this.save = save;
        }

        if ( RefValue ) RefCache.__proto__ = RefValue;
        RefCache.prototype = Object.create( RefValue && RefValue.prototype );
        RefCache.prototype.constructor = RefCache;
        RefCache.prototype.setValue = function setValue (value) {
            var change = RefValue.prototype.setValue.call(this, value);
            if (change && this.save) {
                this.save(this.valueStringify);
            }
            return change;
        };

        return RefCache;
    }(RefValue));

    exports.Ref = Ref;
    exports.RefCache = RefCache;
    exports.RefComputed = RefComputed;
    exports.RefValue = RefValue;
    exports.default = Refs;

    return exports;

}({}));
