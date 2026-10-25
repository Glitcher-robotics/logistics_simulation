interface Scheduled {
  at: number;
  order: number;
  run: () => void;
}

export class EventQueue {
  private entries: Scheduled[] = [];
  private order = 0;

  get size(): number {
    return this.entries.length;
  }

  get nextTime(): number | undefined {
    return this.entries[0]?.at;
  }

  add(at: number, run: () => void): void {
    const entry = { at, order: this.order++, run };
    let index = this.entries.length;
    this.entries.push(entry);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(entry, this.entries[parent]!)) break;
      this.entries[index] = this.entries[parent]!;
      index = parent;
    }
    this.entries[index] = entry;
  }

  take(): Scheduled {
    const first = this.entries[0];
    if (!first) throw new Error('Event queue is empty');
    const last = this.entries.pop()!;
    if (this.entries.length) {
      let index = 0;
      while (index * 2 + 1 < this.entries.length) {
        let child = index * 2 + 1;
        if (
          child + 1 < this.entries.length &&
          this.before(this.entries[child + 1]!, this.entries[child]!)
        )
          child++;
        if (!this.before(this.entries[child]!, last)) break;
        this.entries[index] = this.entries[child]!;
        index = child;
      }
      this.entries[index] = last;
    }
    return first;
  }

  private before(a: Scheduled, b: Scheduled): boolean {
    return a.at < b.at || (a.at === b.at && a.order < b.order);
  }
}
