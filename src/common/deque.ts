import { NumMap, isObjectWithKeys } from './misc';

/**
 * A double-ended queue where each element gets its own sequence number.
 * The sequence numbers must be continous, there can be no gaps.
 * Deque is pronounced [dɘck].
 * @typeParam T Is the type this thing stores.
 */
export default class Deque<T> {
  private _first: number;
  // invariant: _last === null if Deque is empty, else _last >= _first
  private _last: number | null;
  private data: NumMap<T>;

  /**
   * Create an empty Deque
   * @param ind The start number in the timeline, default as 0
   */
  constructor(ind = 0) {
    this.data = {};
    this._last = null;
    this._first = ind;
    this._first -= 1; // NOTE: compensate for `push_back`
  }

  /**
   * @returns the number of elements in this thing
   */
  public get length(): number {
    if (this._last === null) {
      return 0;
    }
    return this._last - this._first + 1;
  }

  /**
   * @returns Sequence number of the first element. If the deque is empty, then
   * this is the last place a value was stored at. Is not meaningful if this
   * Deque is newly made and has not contained any values prior.
   */
  public get first(): number {
    return this._first;
  }

  /**
   * @returns Sequence number of the last element. If the deque is empty, then
   * do the same thing as [[first]].
   */
  public get last(): number {
    return this._last ?? this.first;
  }

  /**
   * @returns The first element, if any.
   */
  public first_elem(): T | undefined {
    if (this._last === null) {
      return undefined;
    }
    return this.data[this._first];
  }

  /**
   * @returns The last element, if any.
   */
  public last_elem(): T | undefined {
    if (this._last === null) {
      return undefined;
    }
    return this.data[this._last];
  }

  /**
   * Gets the element at sequence number `seq`.
   */
  public retrieve(seq: number): T | undefined {
    if (this._last === null || seq < this._first || seq > this._last) {
      return undefined;
    }
    return this.data[seq];
  }

  /**
   * Adds an element at the end.
   * @param elem The element to add
   */
  public push_back(elem: T): void {
    if (this._last === null) {
      this._first += 1;
      this._last = this._first;
    } else {
      this._last += 1;
    }
    this.data[this._last] = elem;
  }

  /**
   * Pops an element from the end. Throws an error if the deque is empty.
   * @returns The popped element.
   */
  public pop_back(): T {
    if (this._last === null) {
      throw new Error('nothing to pop, I am empty');
    }

    const x = this.data[this._last];
    delete this.data[this._last];
    this._last -= 1;
    if (this._last < this._first) {
      this._last = null;
    }
    return x;
  }

  /**
   * Pops an element from the beginning. Throws an error if the deque is empty.
   * @returns The popped element.
   */
  public pop_front(): [T, number] {
    if (this._last === null) {
      throw new Error('nothing to pop, I am empty');
    }

    const x = this.data[this._first];
    const y = this._first;
    delete this.data[this._first];
    this._first += 1;
    if (this._first > this._last) {
      this._first -= 1;
      this._last = null;
    }
    return [x, y];
  }

  /**
   * Shifts all values forward until `this.first` is equal to `newFirst`. It can
   * only shift forwards.
   * @param newFirst the new value of first
   */
  public shift_forward(newFirst: number): void {
    const len = this.length;
    if ((len === 0 && newFirst <= this._first) || newFirst < this._first)
      throw new Error('shift_forward cannot shift backwards');

    this._first = newFirst;
    if (this._last === null) {
      this._first -= 1;
      return;
    }

    let oldLast = this._last;
    this._last = this._first + len - 1;
    for (let i = this._last; i >= this._first; i--) {
      this.data[i] = this.data[oldLast];
      delete this.data[oldLast];
      oldLast -= 1;
    }
  }

  /**
   * @returns The values of this deque in an [[Array]].
   */
  public toArray(): T[] {
    return this.mapArray(x => x);
  }

  /**
   * @param f callback to run on each element.
   * @returns An array in sequential order and every element mapped with `f`.
   */
  public mapArray<F>(f: (T) => F): F[] {
    const res: F[] = [];
    if (this._last !== null) {
      for (let i = this._first; i <= this._last; i++) {
        res.push(f(this.data[i]));
      }
    }
    return res;
  }

  /**
   * Restores a Deque from an array.
   * @param arr The array to restore from.
   * @param first The sequence number all elements in `arr` starts from.
   * @param f A callback to map each value in `arr` to possibly something else.
   * @returns A fresh Deque
   */
  public static fromArrayMap<F, U>(
    arr: F[],
    first: number,
    f: (F) => U,
  ): Deque<U> {
    const newDeque = new Deque<U>();
    newDeque._first = first;
    if (arr.length === 0) {
      return newDeque;
    }

    let counter = first;
    for (const a of arr) {
      newDeque.data[counter] = f(a);
      counter++;
    }
    newDeque._last = counter - 1;
    return newDeque;
  }

  /**
   * Discard elements from the beginning until the value at time `x` (inclusive)
   * is dropped.
   * @param x The time to pop to.
   * @returns The element at `x` if the list is non-empty.
   */
  public discard_front_until(x: number): T | undefined {
    let ret: T | undefined = undefined;
    while (this._last !== null && x >= this._first) {
      ret = this.pop_front()[0];
    }
    return ret;
  }

  /**
   * Only keep the up to `limit` latest elements.
   * @param limit how many elements to keep.
   */
  public trim_to(limit: number): void {
    while (this.length > limit) {
      this.pop_front();
    }
  }

  /**
   * Adds the newer elements of `other` into ourselves if no gaps are formed.
   * @returns true if something new was added.
   */
  public merge_back(other: Deque<T>): boolean {
    if (other._last === null) {
      return false;
    }

    if (
      // they are directly next to each other
      other._first === this.last + 1 ||
      // `other` has newer values, and no gap!
      (other.last > this.last && other._first <= this.last + 1)
    ) {
      for (let i = this.last + 1; i <= other.last; i++) {
        this.data[i] = other.data[i];
      }
      if (this._last === null) {
        this._first += 1;
      }
      this._last = other._last;
      return true;
    }

    return false;
  }

  /**
   * Resets this Deque to contains a value `ele` with sequence number `seq`.
   * @param elem The element this should contain
   * @param seq The sequence to place `elem` at.
   */
  public reset(elem: T, seq: number): void {
    this.data = { [seq]: elem };
    this._first = seq;
    this._last = this._first;
  }

  /**
   * Iterator for for..of loops
   */
  *[Symbol.iterator](): Iterator<T> {
    let cur = this._first;
    while (this._last !== null && cur <= this._last) {
      yield this.data[cur++];
    }
  }

  /**
   * Modifies this Deque in place, mapping all values to some other value.
   * @param callback The function to call on all elements.
   * @typeParam R The new type for the contents.
   * @returns `this` but containing values of type `R` instead of `T`.
   */
  public map_mut<R>(callback: (T) => R): Deque<R> {
    if (this._last !== null) {
      for (let i = this._first; i <= this._last; i++) {
        this.data[i] = callback(this.data[i]) as any;
      }
    }

    return this as any;
  }

  /**
   * Reconstruct a deque from a `JSON.parse` or similar.
   * @param obj A object with the same instance variables as [[Deque]] (even
   * private).
   * @param reviver A function that revives all child elements.
   * @typeParam R The type the revived Deque will contain.
   */
  public static revive<R>(obj: unknown, reviver: (unknown) => R): Deque<R> {
    if (isObjectWithKeys(obj, ['_first', '_last', 'data'])) {
      const x = new Deque<R>();
      x._first = obj['_first'];
      x._last = obj['_last'];
      for (const k in obj['data']) {
        x.data[k] = reviver(obj['data'][k]);
      }
      return x;
    }
    throw new Error("couldn't revive Deque");
  }
}
