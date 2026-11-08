class PilasAudioWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.current = null;
    this.offset = 0;
    this.available = 0;
    this.primed = false;
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
          for (let j = i; j < count; j++) {
            left[j] = 0;
            right[j] = 0;
          }
          return true;
        }
      }

      left[i] = this.current[this.offset];
      right[i] = this.current[this.offset + 1];
      this.offset += 2;
      this.available--;
    }

    return true;
  }
}

registerProcessor("pilas-audio-worklet", PilasAudioWorklet);
