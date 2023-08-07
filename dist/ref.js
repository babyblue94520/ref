import ListenerContainer from './listener';
const refDependMap = new Map();
const scopeMap = new Map();
const computeRefQueue = [];
const scopeQueue = [];
const txRefs = [];
const __clear = '__c';
const __notify = '__n';
let currentScope = {};
let cleaning = false;
let transaction = false;
function listen(ref, scope) {
    scope = getScope(scope);
    getRefScope(scope).listenRefs.push(ref);
    return scope;
}
function clearDepend(ref) {
    if (cleaning)
        return;
    if (transaction) {
        txRefs.push(ref);
        return;
    }
    doClearDepend(scanRef(ref));
}
function clearDepends() {
    if (cleaning)
        return;
    let refMap = new Map();
    txRefs.forEach(ref => scanRef(ref, refMap));
    doClearDepend(refMap);
    txRefs.length = 0;
}
function doClearDepend(refMap) {
    if (refMap.size == 0)
        return;
    cleaning = true;
    refMap.forEach(r => r[__clear]());
    refMap.forEach(r => r[__notify]());
    cleaning = false;
}
function scanRef(ref, collection = new Map()) {
    let map = refDependMap.get(ref);
    if (map) {
        map.forEach(r => {
            if (collection.get(r))
                return;
            collection.set(r, r);
            scanRef(r, collection);
        });
        map.clear();
    }
    return collection;
}
function addDepend(ref) {
    let currentRef = computeRefQueue[computeRefQueue.length - 1];
    if (currentRef) {
        if (currentRef == ref)
            return;
        let refMap = computeIfAbsent(refDependMap, ref, (k) => {
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
    return computeIfAbsent(scopeMap, scope, (k) => {
        return {
            listenRefs: [],
            refMap: new Map()
        };
    });
}
function computeIfAbsent(map, key, callable) {
    let value = map.get(key);
    if (value == undefined) {
        map.set(key, (value = callable(key)));
    }
    return value;
}
const defaultStorage = { getItem(key) { return null; }, setItem(key, value) { }, removeItem(key) { } };
export default class Refs {
    constructor() {
        this.localStorage = defaultStorage;
        this.sessionStorage = defaultStorage;
    }
    /**
     *
     * @param value
     * @param scope
     * @param operators Settable operator.
     * @returns RefValue
     */
    of(value, scope, operators) {
        return new RefValue(getScope(scope), value, operators);
    }
    ofComputed(provider, scope) {
        return new RefComputed(getScope(scope), provider);
    }
    /**
     * Create cacheable Ref.
     */
    ofCache(config, scope, operators) {
        let storage = config.local ? this.localStorage : this.sessionStorage;
        let value;
        let cache = storage.getItem(config.name);
        if (cache && cache != 'undefined') {
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
        let ref = this.of(value, scope, operators);
        ref.listen(() => {
            let value = ref.stringify();
            if (value === undefined) {
                storage.removeItem(config.name);
            }
            else {
                storage.setItem(config.name, value);
            }
        });
        return ref;
    }
    /**
     * Operate any ref in scope.
     */
    runInScope(runnable, scope) {
        try {
            scopeQueue.push(currentScope);
            currentScope = scope;
            runnable();
        }
        finally {
            currentScope = scopeQueue.pop();
        }
    }
    /**
     * Remove all dependencies and listener by scope.
     */
    off(scope) {
        let scopeContext = scopeMap.get(scope);
        if (scopeContext) {
            scopeContext.refMap.forEach((map, ref) => {
                map.delete(ref);
            });
            scopeContext.listenRefs.forEach((ref) => {
                ref.interrupt(scope);
            });
            scopeContext.listenRefs.length = 0;
            scopeContext.refMap.clear();
            scopeMap.delete(scope);
        }
    }
    setLocalStorage(storage) {
        this.localStorage = storage;
    }
    setSessionStorage(storage) {
        this.sessionStorage = storage;
    }
    /**
     * Post notifications after processing all value updates.
     */
    tx(runnable) {
        transaction = true;
        try {
            runnable();
        }
        finally {
            transaction = false;
            clearDepends();
        }
    }
}
export class Ref {
    constructor(scope) {
        this.scope = scope;
        this.listeners = new ListenerContainer();
    }
    stringify() {
        if (this.valueStringify == undefined) {
        }
        return this.valueStringify;
    }
    getScope() {
        return this.scope;
    }
    listen(listener, scope) {
        scope = listen(this, scope);
        listener(this.get(), this.oldValue);
        this.listeners.addListener(listener, scope);
    }
    interrupt(scope) {
        this.listeners.removeAllListener(scope);
    }
    setValue(value) {
        if (this.doSetValue(value)) {
            clearDepend(this);
            this.listeners.dispatch(this.value, this.oldValue);
        }
    }
    doSetValue(value) {
        let stringify = value === undefined ? undefined : JSON.stringify(value);
        if (this.valueStringify === stringify)
            return false;
        this.oldValue = this.value;
        this.value = value;
        this.valueStringify = stringify;
        return true;
    }
}
export class RefValue extends Ref {
    constructor(scope, provider, /** settable operator */ operators) {
        super(scope);
        this.provider = provider;
        this.operators = operators;
        this.doSetValue(provider);
    }
    get() {
        addDepend(this);
        return this.value;
    }
    clear() {
        this.set(this.provider);
    }
    set(value, operator) {
        var _a;
        if ((((_a = this.operators) === null || _a === void 0 ? void 0 : _a.length) || 0) > 0 && this.operators.indexOf(operator) == -1) {
            let message = 'The operator does\'t settable!';
            console.error(message, operator);
            throw new Error(message);
        }
        this.setValue(value);
    }
    /**
     * Operators can only be set once.
     */
    setOperators(...operators) {
        var _a;
        if ((((_a = this.operators) === null || _a === void 0 ? void 0 : _a.length) || 0) > 0) {
            let message = 'Cannot set operators again!';
            console.error(message);
            throw new Error(message);
        }
        this.operators = operators;
    }
}
export class RefComputed extends Ref {
    constructor(scope, provider) {
        super(scope);
        this.provider = provider;
        this.dirty = false;
        this[__clear] = () => {
            this.valueStringify = undefined;
            this.dirty = false;
        };
        this[__notify] = () => {
            if (this.listeners.count() == 0)
                return;
            this.get(true);
        };
    }
    setValue(value) {
        if (this.doSetValue(value)) {
            if (this.dirty) {
                clearDepend(this);
            }
            this.listeners.dispatch(this.value, this.oldValue);
            this.dirty = true;
        }
    }
    get(force = false) {
        addDepend(this);
        if (this.valueStringify == undefined || force) {
            let value;
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
    }
}
