module.exports = class CustomMap extends Map {
    toJSON() {
        return Array.from(this, ([name, val]) => ({ name, value: val }));
    }

    toArray() {
        return this.toJSON().map(x => x.value);
    }
}
