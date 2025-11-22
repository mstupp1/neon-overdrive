/**
 * OBJECT POOLING
 */

class Pool {
    constructor(createFn, maxSize = 200) {
        this.pool = [];
        this.createFn = createFn;
        this.maxSize = maxSize;
    }
    get(...args) {
        let obj = this.pool.pop();
        if (!obj) obj = this.createFn();
        obj.init(...args);
        return obj;
    }
    release(obj) {
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
        }
    }
}
