/* khmerkeyboard.com · voice typing on the device: the microphone tap.
   Runs on the browser's audio thread and hands the sound to voice-local.mjs
   in tenth-of-a-second pieces. Nothing else happens here. */
class KhVoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(1600);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === this.buf.length) {
        this.port.postMessage(this.buf);
        this.buf = new Float32Array(1600);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor("khvoice-capture", KhVoiceCapture);
