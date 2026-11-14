class PilasAudioWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.current = null;
    this.offset = 0;
    this.available = 0;
    this.primed = false;
    this.lastLeft = 0;
    this.lastRight = 0;
    this.fadeIn = 0;
    this.fadeInFrames = 128;
    this.prebufferFrames = 1600;
    this.maxBufferedFrames = 4800;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === "samples" && data.samples) {
        this.queue.push(data.samples);
        this.available += data.samples.length >> 1;
        while (this.available > this.maxBufferedFrames && this.queue.length > 1) {
          const dropped = this.queue.shift();
          this.available -= dropped.length >> 1;
        }
      } else if (data.type === "clear") {
        this.queue.length = 0;
        this.current = null;
        this.offset = 0;
        this.available = 0;
        this.primed = false;
        this.fadeIn = 0;
      }
    };
  }

  process(_, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    const count = left.length;

    if (!this.primed) {
      if (this.available >= this.prebufferFrames) {
        this.primed = true;
        this.fadeIn = 0;
        this.lastLeft = 0;
        this.lastRight = 0;
      } else {
        left.fill(0);
        if (right !== left) right.fill(0);
        return true;
      }
    }

    for (let i = 0; i < count; i++) {
      if (!this.current || this.offset >= this.current.length) {
        this.current = this.queue.shift() || null;
        this.offset = 0;

        if (!this.current) {
          this.primed = false;
          this.available = 0;
          const remaining = count - i;
          for (let j = i; j < count; j++) {
            const g = 1 - (j - i + 1) / remaining;
            left[j] = this.lastLeft * g;
            right[j] = this.lastRight * g;
          }
          this.lastLeft = 0;
          this.lastRight = 0;
          return true;
        }
      }

      let l = this.current[this.offset];
      let r = this.current[this.offset + 1];
      if (this.fadeIn < this.fadeInFrames) {
        const g = (++this.fadeIn) / this.fadeInFrames;
        l *= g;
        r *= g;
      }
      this.lastLeft = l;
      this.lastRight = r;
      left[i] = l;
      right[i] = r;
      this.offset += 2;
      this.available--;
    }

    return true;
  }
}

registerProcessor("pilas-audio-worklet", PilasAudioWorklet);
