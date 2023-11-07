/* eslint-disable */

(function () {
  function getAngle(p1, p2) {
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  }

  function getHypo(p1, p2) {
    return Math.sqrt(p1 * p1 + p2 * p2);
  }

  function glCreateShader(vert, frag) {
    var handle,
      type = gl.VERTEX_SHADER,
      src = vert;
    handle = gl.createShader(type);
    gl.shaderSource(handle, src);
    gl.compileShader(handle);
    var vertex = handle;

    type = gl.FRAGMENT_SHADER;
    src = frag;
    handle = gl.createShader(type);
    gl.shaderSource(handle, src);
    gl.compileShader(handle);
    var fragment = handle;

    var program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);

    gl.useProgram(program);
    var p = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    return [program];
  }

  function glBindShader(shader) {
    gl.useProgram(shader[0]);
  }
  function glUniformLocation(shader, name) {
    return (
      shader[name] || (shader[name] = gl.getUniformLocation(shader[0], name))
    );
  }
  function glCreateTexture() {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  function glSetTexture(t, value) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, value);
  }
  function glBindTexture(t, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    return unit;
  }
  function glCreateFBO() {
    var handle = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, handle);
    var color = glCreateTexture();
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      W,
      H,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      color,
      0,
    );
    return [handle, color];
  }
  function glBindFBO(fbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[0]);
  }
  function glGetFBOTexture(fbo) {
    return fbo[1];
  }

  function SfxrParams() {
    this.ss = function (values) {
      for (var i = 0; i < 24; i++) {
        this[String.fromCharCode(97 + i)] = values[i] || 0;
      }

      // I moved this here from the r(true) function
      if (this["c"] < 0.01) {
        this["c"] = 0.01;
      }

      var totalTime = this["b"] + this["c"] + this["e"];
      if (totalTime < 0.18) {
        var multiplier = 0.18 / totalTime;
        this["b"] *= multiplier;
        this["c"] *= multiplier;
        this["e"] *= multiplier;
      }
    };
  }

  function SfxrSynth() {
    this._p = new SfxrParams();
    var _envelopeLength0, // Length of the attack stage
      _envelopeLength1, // Length of the sustain stage
      _envelopeLength2, // Length of the decay stage
      _period, // Period of the wave
      _maxPeriod, // Maximum period before sound stops (from minFrequency)
      _slide, // Note slide
      _deltaSlide, // Change in slide
      _changeAmount, // Amount to change the note by
      _changeTime, // Counter for the note change
      _changeLimit, // Once the time reaches this limit, the note changes
      _squareDuty, // Offset of center switching point in the square wave
      _dutySweep; // Amount to change the duty by

    this.r = function () {
      // Shorter reference
      var p = this._p;

      _period = 100 / (p["f"] * p["f"] + 0.001);
      _maxPeriod = 100 / (p["g"] * p["g"] + 0.001);

      _slide = 1 - p["h"] * p["h"] * p["h"] * 0.01;
      _deltaSlide = -p["i"] * p["i"] * p["i"] * 0.000001;

      if (!p["a"]) {
        _squareDuty = 0.5 - p["n"] / 2;
        _dutySweep = -p["o"] * 0.00005;
      }

      _changeAmount = 1 + p["l"] * p["l"] * (p["l"] > 0 ? -0.9 : 10);
      _changeTime = 0;
      _changeLimit = p["m"] == 1 ? 0 : (1 - p["m"]) * (1 - p["m"]) * 20000 + 32;
    };

    // I split the r() function into two functions for better readability
    this.tr = function () {
      this.r();

      // Shorter reference
      var p = this._p;

      // Calculating the length is all that remained here, everything else moved somewhere
      _envelopeLength0 = p["b"] * p["b"] * 100000;
      _envelopeLength1 = p["c"] * p["c"] * 100000;
      _envelopeLength2 = p["e"] * p["e"] * 100000 + 12;
      // Full length of the volume envelop (and therefore sound)
      // Make sure the length can be divided by 3 so we will not need the padding "==" after base64 encode
      return (
        (((_envelopeLength0 + _envelopeLength1 + _envelopeLength2) / 3) | 0) * 3
      );
    };

    /**
     * Writes the wave to the supplied buffer ByteArray
     * @param buffer A ByteArray to write the wave to
     * @return If the wave is finished
     */
    this.sw = function (buffer, length) {
      // Shorter reference
      var p = this._p;

      // If the filters are active
      var _filters = p["s"] != 1 || p["v"],
        // Cutoff multiplier which adjusts the amount the wave position can move
        _hpFilterCutoff = p["v"] * p["v"] * 0.1,
        // Speed of the high-pass cutoff multiplier
        _hpFilterDeltaCutoff = 1 + p["w"] * 0.0003,
        // Cutoff multiplier which adjusts the amount the wave position can move
        _lpFilterCutoff = p["s"] * p["s"] * p["s"] * 0.1,
        // Speed of the low-pass cutoff multiplier
        _lpFilterDeltaCutoff = 1 + p["t"] * 0.0001,
        // If the low pass filter is active
        _lpFilterOn = p["s"] != 1,
        // masterVolume * masterVolume (for quick calculations)
        _masterVolume = p["x"] * p["x"],
        // Minimum frequency before stopping
        _minFreqency = p["g"],
        // If the phaser is active
        _phaser = p["q"] || p["r"],
        // Change in phase offset
        _phaserDeltaOffset = p["r"] * p["r"] * p["r"] * 0.2,
        // Phase offset for phaser effect
        _phaserOffset = p["q"] * p["q"] * (p["q"] < 0 ? -1020 : 1020),
        // Once the time reaches this limit, some of the    iables are r
        _repeatLimit = p["p"]
          ? (((1 - p["p"]) * (1 - p["p"]) * 20000) | 0) + 32
          : 0,
        // The punch factor (louder at begining of sustain)
        _sustainPunch = p["d"],
        // Amount to change the period of the wave by at the peak of the vibrato wave
        _vibratoAmplitude = p["j"] / 2,
        // Speed at which the vibrato phase moves
        _vibratoSpeed = p["k"] * p["k"] * 0.01,
        // The type of wave to generate
        _waveType = p["a"];

      var _envelopeLength = _envelopeLength0, // Length of the current envelope stage
        _envelopeOverLength0 = 1 / _envelopeLength0, // (for quick calculations)
        _envelopeOverLength1 = 1 / _envelopeLength1, // (for quick calculations)
        _envelopeOverLength2 = 1 / _envelopeLength2; // (for quick calculations)

      // Damping muliplier which restricts how fast the wave position can move
      var _lpFilterDamping =
        (5 / (1 + p["u"] * p["u"] * 20)) * (0.01 + _lpFilterCutoff);
      if (_lpFilterDamping > 0.8) {
        _lpFilterDamping = 0.8;
      }
      _lpFilterDamping = 1 - _lpFilterDamping;

      var _finished = false, // If the sound has finished
        _envelopeStage = 0, // Current stage of the envelope (attack, sustain, decay, end)
        _envelopeTime = 0, // Current time through current enelope stage
        _envelopeVolume = 0, // Current volume of the envelope
        _hpFilterPos = 0, // Adjusted wave position after high-pass filter
        _lpFilterDeltaPos = 0, // Change in low-pass wave position, as allowed by the cutoff and damping
        _lpFilterOldPos, // Previous low-pass wave position
        _lpFilterPos = 0, // Adjusted wave position after low-pass filter
        _periodTemp, // Period modified by vibrato
        _phase = 0, // Phase through the wave
        _phaserInt, // Integer phaser offset, for bit maths
        _phaserPos = 0, // Position through the phaser buffer
        _pos, // Phase expresed as a Number from 0-1, used for fast sin approx
        _repeatTime = 0, // Counter for the repeats
        _sample, // Sub-sample calculated 8 times per actual sample, averaged out to get the super sample
        _superSample, // Actual sample writen to the wave
        _vibratoPhase = 0; // Phase through the vibrato sine wave

      // Buffer of wave values used to create the out of phase second wave
      var _phaserBuffer = new Array(1024),
        // Buffer of random values used to generate noise
        _noiseBuffer = new Array(32);
      for (var i = _phaserBuffer.length; i--; ) {
        _phaserBuffer[i] = 0;
      }
      for (var i = _noiseBuffer.length; i--; ) {
        _noiseBuffer[i] = getRandomValue(2, -1);
      }

      for (var i = 0; i < length; i++) {
        if (_finished) {
          return i;
        }

        // Repeats every _repeatLimit times, partially rting the sound parameters
        if (_repeatLimit) {
          if (++_repeatTime >= _repeatLimit) {
            _repeatTime = 0;
            this.r();
          }
        }

        // If _changeLimit is reached, shifts the pitch
        if (_changeLimit) {
          if (++_changeTime >= _changeLimit) {
            _changeLimit = 0;
            _period *= _changeAmount;
          }
        }

        // Acccelerate and apply slide
        _slide += _deltaSlide;
        _period *= _slide;

        // Checks for frequency getting too low, and stops the sound if a minFrequency was set
        if (_period > _maxPeriod) {
          _period = _maxPeriod;
          if (_minFreqency > 0) {
            _finished = true;
          }
        }

        _periodTemp = _period;

        // Applies the vibrato effect
        if (_vibratoAmplitude > 0) {
          _vibratoPhase += _vibratoSpeed;
          _periodTemp *= 1 + Math.sin(_vibratoPhase) * _vibratoAmplitude;
        }

        _periodTemp |= 0;
        if (_periodTemp < 8) {
          _periodTemp = 8;
        }

        // Sweeps the square duty
        if (!_waveType) {
          _squareDuty += _dutySweep;
          if (_squareDuty < 0) {
            _squareDuty = 0;
          } else if (_squareDuty > 0.5) {
            _squareDuty = 0.5;
          }
        }

        // Moves through the different stages of the volume envelope
        if (++_envelopeTime > _envelopeLength) {
          _envelopeTime = 0;

          switch (++_envelopeStage) {
            case 1:
              _envelopeLength = _envelopeLength1;
              break;
            case 2:
              _envelopeLength = _envelopeLength2;
          }
        }

        // Sets the volume based on the position in the envelope
        switch (_envelopeStage) {
          case 0:
            _envelopeVolume = _envelopeTime * _envelopeOverLength0;
            break;
          case 1:
            _envelopeVolume =
              1 +
              (1 - _envelopeTime * _envelopeOverLength1) * 2 * _sustainPunch;
            break;
          case 2:
            _envelopeVolume = 1 - _envelopeTime * _envelopeOverLength2;
            break;
          case 3:
            _envelopeVolume = 0;
            _finished = true;
        }

        // Moves the phaser offset
        if (_phaser) {
          _phaserOffset += _phaserDeltaOffset;
          _phaserInt = _phaserOffset | 0;
          if (_phaserInt < 0) {
            _phaserInt = -_phaserInt;
          } else if (_phaserInt > 1023) {
            _phaserInt = 1023;
          }
        }

        // Moves the high-pass filter cutoff
        if (_filters && _hpFilterDeltaCutoff) {
          _hpFilterCutoff *= _hpFilterDeltaCutoff;
          if (_hpFilterCutoff < 0.00001) {
            _hpFilterCutoff = 0.00001;
          } else if (_hpFilterCutoff > 0.1) {
            _hpFilterCutoff = 0.1;
          }
        }

        _superSample = 0;
        for (var j = 8; j--; ) {
          // Cycles through the period
          _phase++;
          if (_phase >= _periodTemp) {
            _phase %= _periodTemp;

            // Generates new random noise for this period
            if (_waveType == 3) {
              for (var n = _noiseBuffer.length; n--; ) {
                _noiseBuffer[n] = getRandomValue(2, -1);
              }
            }
          }

          // Gets the sample from the oscillator
          switch (_waveType) {
            case 0: // Square wave
              _sample = _phase / _periodTemp < _squareDuty ? 0.5 : -0.5;
              break;
            case 1: // Saw wave
              _sample = 1 - (_phase / _periodTemp) * 2;
              break;
            case 2: // Sine wave (fast and accurate approx)
              _pos = _phase / _periodTemp;
              _pos = (_pos > 0.5 ? _pos - 1 : _pos) * 6.28318531;
              _sample =
                1.27323954 * _pos +
                0.405284735 * _pos * _pos * (_pos < 0 ? 1 : -1);
              _sample =
                0.225 * ((_sample < 0 ? -1 : 1) * _sample * _sample - _sample) +
                _sample;
              break;
            case 3: // Noise
              _sample =
                _noiseBuffer[Math.abs(((_phase * 32) / _periodTemp) | 0)];
          }

          // Applies the low and high pass filters
          if (_filters) {
            _lpFilterOldPos = _lpFilterPos;
            _lpFilterCutoff *= _lpFilterDeltaCutoff;
            if (_lpFilterCutoff < 0) {
              _lpFilterCutoff = 0;
            } else if (_lpFilterCutoff > 0.1) {
              _lpFilterCutoff = 0.1;
            }

            if (_lpFilterOn) {
              _lpFilterDeltaPos += (_sample - _lpFilterPos) * _lpFilterCutoff;
              _lpFilterDeltaPos *= _lpFilterDamping;
            } else {
              _lpFilterPos = _sample;
              _lpFilterDeltaPos = 0;
            }

            _lpFilterPos += _lpFilterDeltaPos;

            _hpFilterPos += _lpFilterPos - _lpFilterOldPos;
            _hpFilterPos *= 1 - _hpFilterCutoff;
            _sample = _hpFilterPos;
          }

          // Applies the phaser effect
          if (_phaser) {
            _phaserBuffer[_phaserPos % 1024] = _sample;
            _sample += _phaserBuffer[(_phaserPos - _phaserInt + 1024) % 1024];
            _phaserPos++;
          }

          _superSample += _sample;
        }

        // Averages out the super samples and applies volumes
        _superSample *= 0.125 * _envelopeVolume * _masterVolume;

        // Clipping if too loud
        buffer[i] =
          _superSample >= 1
            ? 32767
            : _superSample <= -1
            ? -32768
            : (_superSample * 32767) | 0;
      }

      return length;
    };
  }

  // Adapted from http://codebase.es/riffwave/
  var synth = new SfxrSynth();
  // Export for the Closure Compiler
  function jsfxr(settings, audioCtx, cb) {
    // Initialize SfxrParams
    synth._p.ss(settings);
    // Synthesize Wave
    var envelopeFullLength = synth.tr();
    var data = new Uint8Array((((envelopeFullLength + 1) / 2) | 0) * 4 + 44);

    var used =
      synth.sw(new Uint16Array(data.buffer, 44), envelopeFullLength) * 2;

    var dv = new Uint32Array(data.buffer, 0, 44);
    // Initialize header
    dv[0] = 0x46464952; // "RIFF"
    dv[1] = used + 36; // put total size here
    dv[2] = 0x45564157; // "WAVE"
    dv[3] = 0x20746d66; // "fmt "
    dv[4] = 0x00000010; // size of the following
    dv[5] = 0x00010001; // Mono: 1 channel, PCM format
    dv[6] = 0x0000ac44; // 44,100 samples per second
    dv[7] = 0x00015888; // byte rate: two bytes per sample
    dv[8] = 0x00100002; // 16 bits per sample, aligned on every two bytes
    dv[9] = 0x61746164; // "data"
    dv[10] = used; // put number of samples here

    // Base64 encoding written by me, @maettig
    used += 44;
    var i = 0,
      base64Characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
      output = "data:audio/wav;base64,";
    for (; i < used; i += 3) {
      var a = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      output +=
        base64Characters[a >> 18] +
        base64Characters[(a >> 12) & 63] +
        base64Characters[(a >> 6) & 63] +
        base64Characters[a & 63];
    }

    audioCtx && audioCtx.decodeAudioData(data.buffer, cb);

    return output;
  }
  /* global jsfxr */

  var audioCtx, audioDest, audio, play; // eslint-disable-line

  var AudioContext = window.AudioContext || window.webkitAudioContext;

  if (AudioContext) {
    audioCtx = new AudioContext();
    audioDest = audioCtx.createDynamicsCompressor();
    var gain = audioCtx.createGain();
    gain.gain.value = !!window.chrome ? 0.2 : 0.4;
    audioDest.connect(gain);
    gain.connect(audioCtx.destination);

    audio = function (conf) {
      // eslint-disable-line no-unused-vars
      var o = [];
      jsfxr(conf, audioCtx, function (buf) {
        o.push(buf);
      });
      return o;
    };
    play = function (o) {
      // eslint-disable-line no-unused-vars
      if (!o[0]) return;
      var source = audioCtx.createBufferSource();
      //o[0].sampleRate+=Math.round(Math.random()*500)
      source.context.sampleRate += ~~getRandomValue(500);
      source.buffer = o[0];
      source.start(0);
      source.connect(audioDest);
      setTimeout(
        function () {
          source.disconnect(audioDest);
        },
        o[0].duration * 1000 + 300,
      );
    };
  } else {
    audio = play = function () {};
  }
  /*
   * Private stuffz
   */

  var enharmonics = "B#-C|C#-Db|D|D#-Eb|E-Fb|E#-F|F#-Gb|G|G#-Ab|A|A#-Bb|B-Cb",
    middleC = 440 * Math.pow(Math.pow(2, 1 / 12), -9),
    numeric = /^[0-9.]+$/,
    octaveOffset = 4,
    space = /\s+/,
    num = /(\d+)/,
    offsets = {};

  // populate the offset lookup (note distance from C, in semitones)
  enharmonics.split("|").forEach(function (val, i) {
    val.split("-").forEach(function (note) {
      offsets[note] = i;
    });
  });

  function Note(str) {
    var couple = str.split(space);
    // frequency, in Hz
    this.frequency = Note.getFrequency(couple[0]) || 0;
    // duration, as a ratio of 1 beat (quarter note = 1, half note = 0.5, etc.)
    this.duration = Note.getDuration(couple[1]) || 0;
  }

  // convert a note name (e.g. 'A4') to a frequency (e.g. 440.00)
  Note.getFrequency = function (name) {
    var couple = name.split(num),
      distance = offsets[couple[0]],
      octaveDiff = (couple[1] || octaveOffset) - octaveOffset,
      freq = middleC * Math.pow(Math.pow(2, 1 / 12), distance);
    return freq * Math.pow(2, octaveDiff);
  };

  Note.getDuration = function (symbol) {
    return numeric.test(symbol)
      ? parseFloat(symbol)
      : symbol
          .toLowerCase()
          .split("")
          .reduce(function (prev, curr) {
            return (
              prev +
              (curr === "w"
                ? 4
                : curr === "h"
                ? 2
                : curr === "q"
                ? 1
                : curr === "e"
                ? 0.5
                : curr === "s"
                ? 0.25
                : 0)
            );
          }, 0);
  };

  function Sequence(ac, tempo, arr) {
    this.ac = ac || new AudioContext();
    this.createFxNodes();
    this.tempo = tempo || 120;
    this.loop = true;
    this.smoothing = 0;
    this.staccato = 0;
    this.notes = [];
    this.push.apply(this, arr || []);
  }

  // create gain and EQ nodes, then connect 'em
  Sequence.prototype.createFxNodes = function () {
    var eq = [
        ["bass", 100],
        ["mid", 1000],
        ["treble", 2500],
      ],
      prev = (this.gain = this.ac.createGain());
    eq.forEach(
      function (config, filter) {
        filter = this[config[0]] = this.ac.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = config[1];
        prev.connect((prev = filter));
      }.bind(this),
    );
    prev.connect(this.ac.destination);
    return this;
  };

  // accepts Note instances or strings (e.g. 'A4 e')
  Sequence.prototype.push = function () {
    Array.prototype.forEach.call(
      arguments,
      function (note) {
        this.notes.push(note instanceof Note ? note : new Note(note));
      }.bind(this),
    );
    return this;
  };

  // create a custom waveform as opposed to "sawtooth", "triangle", etc
  Sequence.prototype.createCustomWave = function (real, imag) {
    // Allow user to specify only one array and dupe it for imag.
    if (!imag) {
      imag = real;
    }

    // Wave type must be custom to apply period wave.
    this.waveType = "custom";

    // Reset customWave
    this.customWave = [new Float32Array(real), new Float32Array(imag)];
  };

  // recreate the oscillator node (happens on every play)
  Sequence.prototype.createOscillator = function () {
    this.stop();
    this.osc = this.ac.createOscillator();

    // customWave should be an array of Float32Arrays. The more elements in
    // each Float32Array, the dirtier (saw-like) the wave is
    if (this.customWave) {
      this.osc.setPeriodicWave(
        this.ac.createPeriodicWave.apply(this.ac, this.customWave),
      );
    } else {
      this.osc.type = this.waveType || "square";
    }

    this.osc.connect(this.gain);
    return this;
  };

  // schedules this.notes[ index ] to play at the given time
  // returns an AudioContext timestamp of when the note will *end*
  Sequence.prototype.scheduleNote = function (index, when) {
    var duration = (60 / this.tempo) * this.notes[index].duration,
      cutoff = duration * (1 - (this.staccato || 0));

    this.setFrequency(this.notes[index].frequency, when);

    if (this.smoothing && this.notes[index].frequency) {
      this.slide(index, when, cutoff);
    }

    this.setFrequency(0, when + cutoff);
    return when + duration;
  };

  // get the next note
  Sequence.prototype.getNextNote = function (index) {
    return this.notes[index < this.notes.length - 1 ? index + 1 : 0];
  };

  // how long do we wait before beginning the slide? (in seconds)
  Sequence.prototype.getSlideStartDelay = function (duration) {
    return duration - Math.min(duration, (60 / this.tempo) * this.smoothing);
  };

  // slide the note at <index> into the next note at the given time,
  // and apply staccato effect if needed
  Sequence.prototype.slide = function (index, when, cutoff) {
    var next = this.getNextNote(index),
      start = this.getSlideStartDelay(cutoff);
    this.setFrequency(this.notes[index].frequency, when + start);
    this.rampFrequency(next.frequency, when + cutoff);
    return this;
  };

  // set frequency at time
  Sequence.prototype.setFrequency = function (freq, when) {
    this.osc.frequency.setValueAtTime(freq, when);
    return this;
  };

  // ramp to frequency at time
  Sequence.prototype.rampFrequency = function (freq, when) {
    this.osc.frequency.linearRampToValueAtTime(freq, when);
    return this;
  };

  // run through all notes in the sequence and schedule them
  Sequence.prototype.play = function (when) {
    when = typeof when === "number" ? when : this.ac.currentTime;
    this.createOscillator();
    this.osc.start(when);

    this.notes.forEach(
      function (note, i) {
        when = this.scheduleNote(i, when);
      }.bind(this),
    );

    this.osc.stop(when);
    this.osc.onended = this.loop ? this.play.bind(this, when) : null;

    return this;
  };

  // stop playback, null out the oscillator, cancel parameter automation
  Sequence.prototype.stop = function () {
    if (this.osc) {
      this.osc.onended = null;
      this.osc.disconnect();
      this.osc = null;
    }
    return this;
  };
  /**
   * custom font 14 segment letter
   */
  var mapLetters = "0123456789?abcdefghijklmnopqrstuvwxyz .-'/";
  var letters = [
    8767, 518, 1115, 1039, 1126, 1133, 1149, 7, 1151, 1135, 5123, 1143, 5391,
    57, 4367, 121, 113, 1085, 1142, 4361, 30, 2672, 56, 694, 2230, 63, 1139,
    2111, 3187, 1133, 4353, 62, 8752, 10294, 10880, 4736, 8713, 0, 16, 1088,
    256, 8704,
  ];

  function drawSegment(xi, yi, offsetX, offsetY) {
    ctx.moveTo(xi, yi);
    ctx.lineTo(xi + offsetX, yi + offsetY);
  }

  function drawLetter14Segments(letter, x, y, size) {
    var size4 = size - 4;
    var size24 = size / 2 - 4;
    // *****
    // |\|/|
    // -- --
    // |\|/|
    // *****
    if (letter & 1) {
      drawSegment(x + 2, y - 1, size4, 0);
    }
    // ---
    // |\/*
    //  --
    // |\/|
    // ---
    if (letter & 2) {
      drawSegment(size + x + 1, y, 0, size - 1);
    }
    // ---
    // |\/|
    //  --
    // |\/*
    // ---
    if (letter & 4) {
      drawSegment(size + x + 1, size + y + 1, 0, size - 1);
    }
    // ---
    // |\/|
    //  --
    // |\/|
    // ***
    if (letter & 8) {
      drawSegment(x + 2, size * 2 + y + 1, size4, 0);
    }
    // ---
    // |\/|
    //  --
    // *\/|
    // ---
    if (letter & 16) {
      drawSegment(x - 1, y + size + 1, 0, size - 1);
    }
    // ---
    // *\/|
    //  --
    // |\/|
    // ---
    if (letter & 32) {
      drawSegment(x - 1, y, 0, size - 1);
    }
    // ---
    // |\/|
    //  *-
    // |\/|
    // ---
    if (letter & 64) {
      drawSegment(x + 2, size + y, size24, 0);
    }
    // ---
    // |*/|
    //  --
    // |/|\|
    // ---
    if (letter & 128) {
      drawSegment(x + 2, y + 2, size24, size4);
    }
    // -----
    // |\*/|
    // -- --
    // |/|\|
    // -----
    if (letter & 256) {
      drawSegment(size / 2 + x, y + 2, 0, size4);
    }
    // -----
    // |\|*|
    // -- --
    // |/|\|
    // -----
    if (letter & 512) {
      drawSegment(size + x - 2, y + 2, -size24, size4);
      //drawSegment(size/2+x+2, size+y-2,size24, size+4);
    }
    // -----
    // |\|/|
    // -- **
    // |/|\|
    // -----
    if (letter & 1024) {
      drawSegment(size / 2 + x + 2, size + y, size24, 0);
    }
    // -----
    // |\|/|
    // -- --
    // |/|*|
    // -----
    if (letter & 2048) {
      drawSegment(size / 2 + x + 2, size + y + 2, size24, size4);
    }
    // -----
    // |\|/|
    // -- --
    // |/*\|
    // -----
    if (letter & 4096) {
      drawSegment(size / 2 + x, size + y + 2, 0, size4);
    }
    // -----
    // |\|/|
    // -- --
    // |*|\|
    // -----
    if (letter & 8192) {
      drawSegment(x + 2, size * 2 + y - 2, size24, -size + 4);
    }
  }
  function drawWord(word, x, y, size, colorIndex, spacing) {
    ctx.save();
    ctx.beginPath();
    setContextAtrribute(colorIndex);
    for (var i = 0; i < word.length; i++) {
      drawLetter14Segments(
        letters[mapLetters.indexOf(word[i])],
        shakeScreen[0] + x - (size + spacing) * (word.length - i),
        shakeScreen[1] + y,
        size,
      );
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  function drawWordCenter(word, x, y, size, colorIndex, spacing) {
    x += ((size + spacing) * word.length) / 2;
    drawWord(word, x, y, size, colorIndex, spacing);
  }
  function drawWordLeft(word, x, y, size, colorIndex, spacing) {
    x += (size + spacing) * word.length;
    drawWord(word, x, y, size, colorIndex, spacing);
  }
  var wordAligns = [drawWordCenter, drawWord];

  function displayWord(word, x, y, size, colorIndexes, side, width) {
    width = width || colorIndexes.length;
    side = side || 0;
    var spacing = size < 25 ? 10 : size * 0.5;
    for (var i = 0; i < width; i++) {
      wordAligns[side](
        word,
        x + i,
        y + i,
        size,
        colorIndexes[i] || colorIndexes[0],
        spacing,
      );
    }
  }
  //ease functions from http://gizma.com/easing
  var linearTween = function (t, b, c, d) {
    return (c * t) / d + b;
  };
  var easeInQuad = function (t, b, c, d) {
    t /= d;
    return c * t * t + b;
  };
  var easeOutQuad = function (t, b, c, d) {
    t /= d;
    return -c * t * (t - 2) + b;
  };

  var easeOutCirc = function (t, b, c, d) {
    t /= d;
    t--;
    return c * Math.sqrt(1 - t * t) + b;
  }; // custom spatialhashing implementation

  var spatialhashing = {};
  var ceilHeight = 84;
  function getHashItem(item) {
    return (
      Math.round(item[0] / ceilHeight) + "-" + Math.round(item[1] / ceilHeight)
    );
  }
  /* add element to spatialhash*/
  function addItem(item) {
    var hash = getHashItem(item);
    spatialhashing[hash] = spatialhashing[hash] || [];
    spatialhashing[hash].push(item);
  }

  function getHash(x, y) {
    return getHashItem([x, y]);
  }
  /* return elements that collides with element*/
  /* only the first element that collides*/
  function collideElements(item) {
    var list = {};
    var elements = [];
    for (var i = 0; i < 9; i++) {
      var hash = getHash(
        item[0] + ((i % 3) - 1) * ceilHeight,
        item[1] + (~~(i / 3) - 1) * ceilHeight,
      );
      if (!list[hash]) {
        list[hash] = 1;
        var elements = spatialhashing[hash];
        for (var i = 0; elements && i < elements.length; i++) {
          if (
            getHypo(item[1] - elements[i][1], item[0] - elements[i][0]) <
            elements[i][2] + item[2]
          ) {
            return elements[i];
          }
        }
      }
    }
  }
  var BADCOLOR_FRAG =
    "precision highp float;uniform vec2 dim;uniform sampler2D tex;varying vec2 uv;uniform float time;uniform vec3 colors;void main(){float a=sin(time);vec4 b=texture2D(tex,uv);vec4 c=texture2D(tex,uv+vec2((-15./dim.x),0));vec4 d=texture2D(tex,uv+vec2((15./dim.x),0));vec4 e=texture2D(tex,uv+vec2((-7.5/dim.x),0));if(colors.r==1.){b.r=b.r+d.r*max(1.,sin(uv.y*dim.y*1.2))*a;}if(colors.g==1.){b.b=b.b+c.b*max(1.,sin(uv.y*dim.y*1.2))*a;}if(colors.b==1.){b.g=b.g+e.g*max(1.,sin(uv.y*dim.y*1.2))*a;}gl_FragColor.rgba=b.rgba;}";
  var CRT_FRAG =
    "precision highp float;uniform vec2 dim;uniform sampler2D tex;varying vec2 uv;uniform float time;uniform vec3 colors;void main(){vec2 a=uv*dim;a-=dim/2.;float b=length(a);if(b<600.){float c=b/600.;a*=mix(1.,smoothstep(0.0,600./b,c),.125);}a+=dim/2.;vec4 d=texture2D(tex,a/dim);float e=distance(uv,vec2(.5,.5));d.rgb*=smoothstep(.8,.2*.8,e);gl_FragColor=d;}";
  var CUT_FRAG =
    "precision highp float;uniform vec2 dim;uniform sampler2D tex;varying vec2 uv;uniform float time;uniform vec3 colors;void main(){float a=5.;float b=.5;vec2 c=uv*dim;vec2 d=c+vec2(floor(sin(c.y/a*time+time*time))*b*time,0);d=d/dim;vec4 e=texture2D(tex,d);gl_FragColor.rgba=e.rgba;}";
  var GLOW_FRAG =
    "precision highp float;uniform vec2 dim;uniform sampler2D tex;varying vec2 uv;uniform float time;uniform vec3 colors;void main(){vec2 a=uv*dim;vec4 b=texture2D(tex,uv);vec4 c=vec4(.0);float d=.02*sin(time)+.3;float e=.03;vec4 f=texture2D(tex,uv+vec2((-15./dim.x)*d,0));for(int g=0;g<9;g++){float h=float(mod(float(g),4.));float i=float(g/3);vec2 j=vec2(a.x+h,a.y+i);vec2 k=vec2(a.x-h,a.y+i);vec2 l=vec2(a.x+h,a.y-i);vec2 m=vec2(a.x-h,a.y-i);c+=texture2D(tex,j/dim)*e;c+=texture2D(tex,k/dim)*e;c+=texture2D(tex,l/dim)*e;c+=texture2D(tex,m/dim)*e;}b+=c;vec4 n=texture2D(tex,uv+vec2((8./dim.x)*d,0));vec4 o=texture2D(tex,uv+vec2((-7.5/dim.x)*d,0));float p=max(1.,sin(uv.y*dim.y*1.2)*2.5)*d;b.r=b.r+n.r*p;b.b=b.b+f.b*p;b.g=b.g+o.g*p;vec2 q=uv*sin(time);float r=fract(sin(dot(q.xy,vec2(12.,78.)))*43758.);vec3 s=vec3(r);b.rgb=mix(b.rgb,s,.015);gl_FragColor.rgba=b;}";
  var SLIT_FRAG =
    "precision highp float;uniform vec2 dim;uniform sampler2D tex;varying vec2 uv;uniform float time;uniform vec3 colors;void main(){vec2 a=uv*dim;vec2 b=vec2(3.+floor(a.x/time)*time,a.y);vec4 c=texture2D(tex,b/dim);gl_FragColor.rgba=c.rgba;}";
  var SWELL_FRAG =
    "precision highp float;uniform vec2 dim;uniform sampler2D tex;varying vec2 uv;uniform float time;uniform vec3 colors;void main(){vec4 a=texture2D(tex,uv);if(time==.0){gl_FragColor.rgba=a.bgra;}else{gl_FragColor.rgba=a.rgba;}}";
  var TWIST_FRAG =
    "precision highp float;uniform vec2 dim;uniform sampler2D tex;varying vec2 uv;uniform float time;uniform vec3 colors;void main(){float a=.3;float b=.3;float c=10.*time;float d=10.*time;float e=dim.x;float f=dim.y;vec2 g=uv*dim;vec2 h=vec2(max(3.,min(float(e),g.x+sin(g.y/(153.25*a*a)*a+a*c+b*3.)*d)),max(3.,min(float(f),g.y+cos(g.x/(251.57*a*a)*a+a*c+b*2.4)*d)-3.));vec4 i=texture2D(tex,h/dim);gl_FragColor.rgba=i.rgba;}";
  var STATIC_VERT =
    "attribute vec2 p;varying vec2 uv;void main(){gl_Position=vec4(p,.0,1.);uv=.5*(p+1.);}";

  var glprops = { preserveDrawingBuffer: true };
  var gl =
      c.getContext("webgl", glprops) ||
      c.getContext("experimental-webgl", glprops),
    ctx = g.getContext("2d"),
    FW = 800,
    FH = 600,
    GAME_MARGIN = 0,
    GAME_Y_MARGIN = GAME_MARGIN,
    GAME_INC_PADDING = 80,
    W = FW - 2 * GAME_MARGIN,
    H = FH - 2 * GAME_Y_MARGIN,
    borderLength = 2 * (W + H + 2 * GAME_INC_PADDING),
    storage = localStorage,
    shakeScreen = [0, 0],
    glitchTime = 0,
    frame = 0,
    GLITCHS = [0, 0, 0, 0, 0, 0, 0],
    godMode = !!storage.getItem("godMode"),
    startFromGodMode = false;
  // DOM setup
  d.style.webkitTransformOrigin = d.style.transformOrigin = "0 0";

  g.width = c.width = W;
  g.height = c.height = H;
  c.style.top = GAME_Y_MARGIN + "px";
  c.style.left = GAME_MARGIN + "px";
  document.oncontextmenu = function (e) {
    e.preventDefault();
  };

  s.style.width = c.clientWidth;
  window.addEventListener("resize", () => {
    let rect = c.getBoundingClientRect();
    s.style.width = rect.width + "px";
  });

  // WebGL setup
  gl.viewport(0, 0, W, H);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
    ]),
    gl.STATIC_DRAW,
  );

  var glowShader = glCreateShader(STATIC_VERT, GLOW_FRAG);
  gl.uniform2f(glUniformLocation(glowShader, "dim"), W, H);
  var crtShader = glCreateShader(STATIC_VERT, CRT_FRAG);
  gl.uniform2f(glUniformLocation(crtShader, "dim"), W, H);
  var badColorShader = glCreateShader(STATIC_VERT, BADCOLOR_FRAG);
  gl.uniform2f(glUniformLocation(badColorShader, "dim"), W, H);
  var cutShader = glCreateShader(STATIC_VERT, CUT_FRAG);
  gl.uniform2f(glUniformLocation(cutShader, "dim"), W, H);
  var twistShader = glCreateShader(STATIC_VERT, TWIST_FRAG);
  gl.uniform2f(glUniformLocation(twistShader, "dim"), W, H);
  var swellShader = glCreateShader(STATIC_VERT, SWELL_FRAG);
  gl.uniform2f(glUniformLocation(swellShader, "dim"), W, H);
  var slitShader = glCreateShader(STATIC_VERT, SLIT_FRAG);
  gl.uniform2f(glUniformLocation(slitShader, "dim"), W, H);

  var fbo1 = glCreateFBO();
  var fbo2 = glCreateFBO();

  var textureGame = glCreateTexture();
  // colors
  var colors = [
    "#FFF", //0 white
    "rgba(40,77,153,0.6)", //1 normal
    "rgba(234,34,37,0.6)", //2 corruption or  'rgba(231,197,11,0.3)';
    "rgba(180,0,50,0.3)", //3 red eye for flower of life
    "#F952FF", //4 cursor color
    "rgba(0,77,153,0.6)", //5 soft  white line to glow
    "rgb(72,255,206)", //6 hero
    "rgba(0,0,0,0.1)", //7f screen cleaner
    "rgba(7,8,12,0.2)", // 8f corruption background
    "rgb(40,145,160)", //9f bullet color
    "#F66", //10 button start again
    ,
    ,
    "#6FF", //13 button fire to start& controls
    "#066", //14 stroke line buttons
    "#0FF", //15 hit enemy strokeline
    "rgba(235,118,71,0.8)", //16 enemy stroke release
    "#559", //17 enemy stroke charging,
    "#F6F", //18 colors glow ,
    "#2F2", //19 score color,
    "#000", //20 message color1
    "#973", //21 message color1,
    "rgba(0,0,0,0.71)", //22 darken
    "rgb(2,1,2)", //23 splash background
    "rgba(255,102,192,0.8)", //24 enemy 1
    "rgba(255,102,102,0.8)", //25 enemy 2
    //'rgba(235,118,71,0.8)',//25 enemy 2
    "rgba(252,233,128,0.8)", //26 enemy 3
    "rgba(150,127,254,0.8)", //27 enemy 4
    "rgba(179,72,108,0.8)", //28 enemy 5 guardian
    "rgba(179,88,52,0.8)", //29 enemy 6 bullet
    "rgba(128,108,26,0.8)", //30 enemy 7
    "rgba(128,155,15,0.8)", //31 enemy 8
    "rgba(128,131,51,0.8)", //32 enemy 9
    "hsla(324,50%, 60%, 0.88)", //33 enemy 10
    "hsla(360,50%, 60%, 0.88)", //34 enemy 11
    "hsla(10,50%, 60%, 0.88)", //35 enemy 12
    "hsla(20,50%, 60%, 0.88)", //36 enemy 13
    "hsla(30,50%, 60%, 0.88)", //37 enemy 14
    "rgba(7,8,12,0.2)", //38
  ];

  function setContextAtrribute(index, attribute, custom) {
    ctx[["strokeStyle", "fillStyle", "lineWidth"][attribute || 0]] =
      custom || colors[index];
  }
  /**enemies must have colors?*/
  function setRandomColor(r, r2, g, g2, b, b2, a, a2) {
    var value =
      "rgba(" +
      ~~getRandomValue(r, r2) +
      "," +
      ~~getRandomValue(g, g2) +
      "," +
      ~~getRandomValue(b, b2) +
      "," +
      getRandomValue(a, a2) +
      ")";
    setContextAtrribute(-1, 1, value);
  }
  /*
   * original script from @gre
   * https://github.com/gre/behind-asteroids/blob/master/src/effects.sh
   */

  function setFrameBuffer(param1, param2, shader, time, colors) {
    glBindFBO(param1);
    glBindShader(shader);
    gl.uniform1i(glUniformLocation(shader, "tex"), glBindTexture(param2, 0));
    if (time != undefined) {
      gl.uniform1f(glUniformLocation(shader, "time"), time);
    }
    if (colors) {
      gl.uniform3fv(glUniformLocation(shader, "colors"), colors);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function drawPostProcessing(time) {
    glSetTexture(textureGame, g);
    glitchTime--;
    for (var i = 0; i < GLITCHS.length; i++) {
      GLITCHS[i]--;
    }

    setFrameBuffer(fbo1, textureGame, badColorShader, (frame / 60) % 180, [
      glitchTime + 1 > 0 || GLITCHS[0] > 0 ? 1 : 0,
      glitchTime + 2 > 0 || GLITCHS[1] > 0 ? 1 : 0,
      glitchTime > 0 || GLITCHS[2] > 0 ? 1 : 0,
    ]);
    setFrameBuffer(
      fbo2,
      glGetFBOTexture(fbo1),
      cutShader,
      glitchTime > 0 || GLITCHS[3] > 0 ? 15 : 0,
    );

    setFrameBuffer(
      fbo1,
      glGetFBOTexture(fbo2),
      twistShader,
      glitchTime + 1 > 0 || GLITCHS[4] > 0 ? 1 : 0,
    );
    // swell free for effects
    setFrameBuffer(
      fbo2,
      glGetFBOTexture(fbo1),
      swellShader,
      GLITCHS[7] > 0 && frame % 3 == 0 ? 0 : 1,
    );
    setFrameBuffer(
      fbo1,
      glGetFBOTexture(fbo2),
      slitShader,
      glitchTime > 0 || GLITCHS[5] > 0 ? 9 : 1,
    );
    // glow
    setFrameBuffer(fbo2, glGetFBOTexture(fbo1), glowShader, frame);
    setFrameBuffer(fbo1, glGetFBOTexture(fbo2), crtShader);

    // Final draw
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.flush();
  }
  // mouse states
  // x, y, down
  var coords = [0, 0, 0];

  c.onmousedown = function (e) {
    coords[2] = e.which == 3 ? 0 : 1;
    coords[3] = e.which == 3 ? 1 : 0;
    e.preventDefault();
  };

  c.onmouseup = function (e) {
    coords[2] = 0;
    coords[3] = 0;
    e.preventDefault();
  };

  c.onmousemove = function (e) {
    if (GLITCHS[6] > 0) return;
    coords[0] = (e.offsetX * FW) / c.offsetWidth;
    coords[1] = (e.offsetY * FH) / c.offsetHeight;
  };
  var keyMap = 0;
  var keys = {
    65: 1, // left
    87: 2, // up
    68: 4, // right
    83: 8, // down
  };

  document.onkeydown = function (e) {
    var key = e.keyCode || e.which;
    if (keys[key]) {
      keyMap |= keys[key];
    }
  };

  document.onkeyup = function (e) {
    var key = e.keyCode ? e.keyCode : e.which;
    if (keyMap & keys[key]) {
      keyMap ^= keys[key];
    }
  };
  // create the audio context
  var ac = new AudioContext(),
    // get the current Web Audio timestamp (this is when playback should begin)
    when = ac.currentTime,
    // set the tempo
    tempo = 138,
    // initialize some vars
    sequence1,
    sequence2,
    sequence3,
    sequence4,
    // create an array of "note strings" that can be passed to a sequence
    bb1 = "Bb1 s",
    d2 = "D2 s",
    ab1 = "Ab1 s",
    g2be = "G2b e";
  (g2e = "G2 e"),
    (c2e = "C2 e"),
    (lead = [
      bb1,
      d2,
      bb1,
      d2,
      bb1,
      d2,
      bb1,
      d2,
      bb1,
      d2,
      bb1,
      d2,
      bb1,
      d2,
      bb1,
      d2,
      ab1,
      d2,
      ab1,
      d2,
      ab1,
      d2,
      ab1,
      d2,
      ab1,
      d2,
      ab1,
      d2,
      ab1,
      d2,
      ab1,
      d2,
    ]),
    (harmony = [
      g2e,
      g2be,
      g2e,
      g2be,
      g2e,
      g2be,
      g2e,
      g2be,
      c2e,
      g2be,
      c2e,
      g2be,
      c2e,
      g2be,
      c2e,
      g2be,
    ]),
    (bass2 = ["- w", "D1 s", "- s", "D1 e", "- q", "- m", "- w"]),
    (basebass = ["C1 e", "- e", "A1 e", "- e"]),
    (bass = basebass);

  // create 3 new sequences (one for lead, one for harmony, one for bass)
  sequence1 = new Sequence(ac, tempo, lead);
  sequence2 = new Sequence(ac, tempo, harmony);
  sequence3 = new Sequence(ac, tempo, bass);
  sequence4 = new Sequence(ac, tempo, bass2);

  // set staccato and smoothing values for maximum coolness
  sequence1.staccato = 0.81;
  sequence2.staccato = 0.55;
  sequence3.staccato = 0.05;
  sequence3.smoothing = 0.35;
  sequence4.staccato = 0.05;

  // adjust the levels so the bass and harmony aren't too loud
  sequence1.gain.gain.value = 0.12;
  sequence2.gain.gain.value = 0.09;
  sequence3.gain.gain.value = 0.11;
  sequence4.gain.gain.value = 0.1;

  //sequence1.play(when + 40);
  //sequence3.play(when + 10);
  //sequence4.play(when + 1);
  //sequence2.play(when + 100);
  // the frequency is the sixth value index 5

  function mutates(sound, mutations) {
    var sounds = [];
    for (var i = 0; i < mutations; i++) {
      var newSound = sound.slice();
      newSound[5] = (i - mutations / 2) * 0.05 + sound[5];
      sounds.push(audio(newSound));
    }
    return sounds;
  }

  var gameStarts = audio([
    3,
    0.2421,
    0.1876,
    0.1891,
    0.2844,
    0.5008,
    ,
    -0.0619,
    0.2484,
    ,
    0.0432,
    -0.7113,
    0.3743,
    0.007,
    0.0008,
    0.0474,
    -0.0023,
    0.705,
    0.7098,
    0.0034,
    0.011,
    0.0259,
    0.0005,
    0.42,
  ]);
  var baseFireSound = [
    0,
    ,
    0.12,
    0.14,
    0.3,
    0.8,
    ,
    -0.3399,
    0.04,
    ,
    ,
    -0.04,
    ,
    0.51,
    -0.02,
    ,
    -0.74,
    ,
    0.21,
    0.24,
    ,
    ,
    0.02,
    0.41,
  ];
  var fireSounds = mutates(baseFireSound, 6);
  var totemAppears = audio([
    1,
    ,
    0.38,
    ,
    0.03,
    0.03,
    ,
    0.8799,
    0.96,
    0.9411,
    0.9785,
    -0.9219,
    0.82,
    0.7513,
    0.6049,
    0.8,
    -0.6041,
    -0.8402,
    0.28,
    0.7,
    0.78,
    0.1423,
    -0.7585,
    0.5,
  ]);
  var enemyDie = audio([
    3,
    0.0597,
    0.11,
    0.2,
    0.2513,
    0.5277,
    ,
    0.5841,
    -0.0248,
    -0.076,
    0.5312,
    -0.2978,
    0.7065,
    -0.9091,
    0.4202,
    0.966,
    0.7036,
    0.4575,
    1,
    -0.9064,
    0.6618,
    0.0266,
    -0.0655,
    0.42,
  ]);
  var heroSpeedUp = audio([
    2,
    ,
    0.09,
    0.06,
    0.45,
    0.27,
    0.02,
    -0.28,
    0.82,
    0.41,
    0.58,
    -0.88,
    0.07,
    0.448,
    -0.355,
    1,
    0.54,
    -0.073,
    1,
    ,
    ,
    ,
    ,
    0.42,
  ]);
  var totemDestroyed = audio([
    3,
    0.002,
    0.6302,
    0.499,
    0.0804,
    0.5224,
    ,
    -0.0324,
    0.0004,
    0.5448,
    ,
    -0.7762,
    -0.1765,
    0.6762,
    -0.4386,
    0.7747,
    -0.0347,
    -0.2051,
    0.931,
    -0.0732,
    0.4693,
    0.1444,
    ,
    0.42,
  ]);
  var heroDie = audio([
    1,
    0.145,
    0.2094,
    0.4645,
    0.4954,
    0.7134,
    ,
    -0.1659,
    -0.8866,
    0.9733,
    ,
    -0.572,
    -0.7927,
    -0.1186,
    0.4699,
    0.6044,
    0.4604,
    0.1762,
    0.9998,
    0.0236,
    0.1554,
    ,
    0.659,
    0.42,
  ]);
  var glitchStop = audio([
    1,
    0.0076,
    0.66,
    ,
    ,
    0.09,
    ,
    0.96,
    0.32,
    0.1,
    0.97,
    -1,
    ,
    0.0615,
    -0.1587,
    1,
    ,
    -0.02,
    0.83,
    0.12,
    0.23,
    0.0231,
    -0.02,
    0.96,
  ]);
  var baseEnemyHit = [
    3,
    0.0691,
    0.183,
    0.0949,
    0.5678,
    0.46,
    ,
    -0.0001,
    ,
    ,
    ,
    -0.542,
    -0.2106,
    -0.2402,
    -0.1594,
    ,
    -0.3133,
    -0.0707,
    0.1592,
    -0.4479,
    0.5788,
    0.0169,
    -0.919,
    0.42,
  ];
  var hitSounds = mutates(baseEnemyHit, 8);
  var openingGlitch = audio([
    3,
    0.0258,
    0.16,
    0.0251,
    0.16,
    0.05,
    ,
    -0.86,
    -0.4088,
    0.0956,
    0.256,
    -0.62,
    ,
    -0.0006,
    -0.0352,
    ,
    -0.0882,
    -0.0443,
    0.9219,
    -0.0531,
    0.8727,
    0.031,
    0.0002,
    0.6,
  ]);
  var bossSummon = audio([
    0,
    0.95,
    0.34,
    0.03,
    0.05,
    0.51,
    ,
    0.96,
    0.84,
    0.05,
    0.51,
    -0.84,
    0.99,
    0.82,
    ,
    1,
    ,
    -0.88,
    0.87,
    1,
    0.5,
    0.21,
    0.94,
    0.65,
  ]);
  var spatialhashing,
    mapSize,
    tileset,
    gameOver,
    mapPixels,
    map,
    slowMotion,
    viewPort,
    enemies,
    hero,
    heroShape,
    bullets,
    particles,
    message,
    particleZ,
    score,
    glitchStoped,
    triggers,
    bigKiller,
    times,
    newRecord;
  function init() {
    (spatialhashing = {}),
      (mapSize = 21),
      (tileset = 40),
      (gameOver = false),
      (frame = 0),
      (mapPixels = mapSize * tileset),
      (map = []),
      (slowMotion = 0.3),
      (viewPort = [
        (FW - mapPixels) / 2,
        (FH - mapPixels) / 2,
        FW / 2 - 30,
        FH / 2 - 30,
      ]), // [x, y, leftOffset, topOffset]
      // [0x, 1y, 2size, 3angle, 4speed, 5crossFireAngle, 6countDown, 7bulletRatio, 8dashCountDown, 9dashcolddown]
      (enemies = []),
      (hero = [tileset * 10.5, tileset * 10.5, 16, 0, 150, 0, 0, 12, 0, 0]),
      (heroShape = [
        [0, 1, 0, -1],
        [-1, 1, 0.5, 1],
      ]),
      //0x, 1y, 2size, 3angle
      (bullets = []),
      // enemy description
      // 0x, 1y, 2size, 4angleIncrement, 3angle, 5angleMomentum, 6xpath, 7ypath, 8hit
      // 0x, 1y, 2size, 3angle, 4index, 5type, 6hits, 7path, 8path, 9customdata
      // totem description
      // totem spawns enemies
      // 0x, 1y, 2size, 3angle, 4xpath, 5ypath, 6hitpoints, 7nextInvocation
      (particles = []),
      (message = ""),
      (particleZ = Math.PI / 2),
      (score = 0),
      (glitchTime = 0),
      (wave = 1),
      //012=rgb, 3, 4, 5, 6stop, 7 nada,
      (GLITCHS = [0, 0, 0, 0, 0, 0, 0, 0]),
      (glitchStoped = false),
      (triggers = {
        //1st wave
        500: [1, sequence4],
        2500: [0, 10, 5, 10],
        //2st wave
        8999: [5, "what are you doing?"],
        10500: [1, sequence3],
        10800: [8, 2],
        11000: [0, 5, 5, 10],
        18000: [0, 15, 15, 10],
        18001: [5, ""],
        25000: [0, 15, 5, 10],
        31000: [0, 5, 15, 10],
        37000: [0, 10, 11, 11],
        37500: [1, sequence1],
        46000: [5, "are you trying to stop us?"],
        // some broken in the matrix
        48500: [2, 10, 0, 0, 0, 10, 10, 10],
        49000: [2, 10, 10, 10, 15, 10, 20, 10],
        49001: [4, sequence3, 1],
        49002: [4, sequence1, 1],
        49003: [4, sequence4, 1],
        49500: [8, 3],
        50004: [2, 60, 60, 68, 55, 50, 45, 60],
        51000: [4, sequence3, 138],
        51001: [4, sequence1, 138],
        51002: [4, sequence4, 138],
        51003: [5, "we are perfection"],
        //3st wave
        52000: [0, 4, 10, 11],
        53000: [0, 14, 10, 10],
        55550: [5, ""],
        61000: [0, 10, 16, 11],
        61003: [5, "we are creation"],
        66550: [5, ""],
        67000: [0, 16, 10, 11],
        68000: [0, 6, 10, 10],
        72000: [0, 10, 4, 11],
        // some cool effect for the summon in the middle
        80501: [2, 1000, 0, 0, 0, 0, 0, 10],
        83000: [0, 10, 9, 12],
        83500: [1, sequence2],
        95050: [5, "you must stop this"],
        99950: [5, "it's inevitable!"],
        99980: [8, 4],
        100000: [0, 10, 1, 12],
        103050: [5, ""],
        106000: [0, 1, 10, 12],
        111000: [0, 19, 10, 12],
        116000: [0, 10, 19, 12],
        // some cool effect
        140000: [8, 5],
        140001: [5, "can't you understand?"],
        //5st wave
        141600: [0, 10, 12, 10],
        141601: [0, 12, 13, 10],
        141602: [0, 12, 15, 10],
        141603: [0, 10, 16, 10],
        141604: [0, 8, 15, 10],
        141605: [0, 8, 13, 10],
        145050: [5, ""],
        156800: [6, "stop"],
        156900: [6, "now"],
        157000: [0, 10, 14, 13], //3
        180000: [6, "you"],
        180100: [6, "are"],
        180200: [6, "the"],
        180300: [6, "glitch"],
        181000: [8, 6],
        //6th wave
        182000: [7, sequence1],
        182050: [7, sequence2],
        182100: [7, sequence3],
        182150: [7, sequence4],
        185100: [2, 300, 0, 300, 0, 0, 0, 0],
        // mega special summon
        187000: [0, 10, 10, 14],
        189000: [1, sequence1],
        189001: [1, sequence2],
        189002: [1, sequence3],
        189003: [1, sequence4],
        //god mode
        300100: [1, sequence4],
        305000: [0, 10, 5, 10],
        308000: [1, sequence3],
        310000: [0, 10, 6, 11],
        311000: [1, sequence4],
        315000: [0, 14, 6, 10],
        317000: [0, 14, 14, 10],
        319000: [0, 6, 14, 10],
        320000: [0, 6, 6, 10],
        335000: [0, 11, 11, 12],
        336000: [0, 9, 11, 12],
        337000: [0, 11, 9, 12],
        338000: [0, 9, 9, 12],
        350000: [0, 19, 19, 11],
        352000: [0, 1, 19, 11],
        354000: [0, 1, 1, 11],
        355000: [0, 19, 1, 11],
        365000: [0, 10, 8, 10],
        366000: [0, 11, 9, 10],
        367000: [0, 12, 10, 10],
        368000: [0, 11, 11, 10],
        369000: [0, 10, 12, 10],
        370000: [0, 9, 11, 10],
        371000: [0, 8, 10, 10],
        372000: [0, 9, 9, 10],
        395000: [0, 1, 1, 12],
        395001: [0, 1, 19, 12],
        395002: [0, 19, 19, 12],
        395003: [0, 20, 1, 12],
        395004: [0, 10, 10, 12],
        425000: [0, 0, 10, 13],
        425001: [0, 20, 10, 13],
        570001: [0, 10, 10, 13],
      }),
      (bigKiller = undefined); // reference for enemy followers

    for (var i = 0; i < mapSize; i++) {
      map.push([]);
      for (var j = 0; j < mapSize; j++) {
        map[i].push([]);
      }
    }
    for (var i = 0; i < mapSize - 1; i++) {
      if (i == 10) continue;
      triggers[450000 + i * 6000] = [0, i, i, 10];
      triggers[453000 + i * 6000] = [0, mapSize - i - 1, i, 10];
    }
    times = Object.keys(triggers).map(function (element) {
      return parseInt(element);
    });
    //map[5][5]=1;

    // enemy type movement,
    /*types
  0-5 enemies that moves
  enemy[9][angleIncrement, angleMomentun]
  >5 totems 
  */
    sequence1.stop();
    sequence2.stop();
    sequence3.stop();
    sequence4.stop();
    record = parseFloat(storage.getItem("record") || 0);
    for (var i = 0; buttons && i < buttons.length; i++) {
      buttons[i][3] = false;
    }
    newRecord = false;
    randomGlitch();
    loadGod();
  }

  function loadGod() {
    if (godMode) {
      heroShape = [
        [
          0, -0.5, -0.25, -1, -0.5, -0.4, -0.5, -0.25, 0, 0.25, 0.5, 0.4, 0.5,
          1, 0.25, 0.5,
        ],
        [
          -0.25, 0, -1, 0.25, 0.75, 0.5, 0.25, 0.2, 0.8, 0.2, 0.25, 0.5, 0.75,
          0.25, -1, 0,
        ],
      ];
      hero[4] = 160;
      hero[2] = 20;
      hero[7] = 22;
    }
    if (startFromGodMode) {
      score = 300000;
      wave = 7;
      for (var i = times.length - 1; i >= 0; i--) {
        if (times[i] < 300000) {
          times.splice(i, 1);
        }
      }
    }
  }
  var splashScreen = true;
  var animationLine = 0;
  var distanceLine = 30;
  var controlHelp = false;
  var fade = 0;
  function drawDiagonal(x, y, width, vertical, offset) {
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + (vertical ? offset : width),
      y + (vertical ? width : offset),
    );
  }
  function drawLine(x, y, width, vertical) {
    drawDiagonal(x, y, width, vertical, 0);
  }
  function crossLine(x, y, width) {
    drawLine(x, y, width, true);
    drawLine(y, x, width);
  }

  function drawSplash() {
    ctx.save();
    ctx.beginPath();
    setContextAtrribute(23, 1);
    ctx.fillRect(0, 0, FW, FH);

    setContextAtrribute(0);
    //
    var halfHeight = FH / 2;
    var horizon = distanceLine * 2;
    ctx.beginPath();
    for (var i = 0; i < halfHeight / distanceLine; i++) {
      var dis = easeInQuad(
        i * distanceLine + animationLine,
        halfHeight + horizon,
        halfHeight,
        halfHeight,
      );
      setContextAtrribute(1);
      drawLine(0, dis + 0.5, FW);
    }
    ctx.stroke();
    ctx.beginPath();
    for (var i = 0; i < halfHeight / distanceLine; i++) {
      var dis = easeInQuad(
        i * distanceLine + animationLine,
        halfHeight + horizon,
        halfHeight,
        halfHeight,
      );
      setContextAtrribute(2);
      drawLine(0, FH - dis - 0.5, FW);
    }
    ctx.stroke();
    var limit = halfHeight - horizon;
    setContextAtrribute(2);
    ctx.beginPath();
    drawLine(0, limit, FW);
    drawLine(FW / 2, limit, -limit, true);
    ctx.stroke();

    setContextAtrribute(1);
    ctx.beginPath();
    drawLine(0, FH - limit, FW);
    drawLine(FW / 2, FH - limit, limit, true);
    ctx.stroke();
    ctx.beginPath();
    for (var i = 1; i < FW / (distanceLine * 2); i++) {
      var offset = i * i * 5 + 25;
      setContextAtrribute(2);
      drawDiagonal(i * distanceLine + FW / 2, limit, -limit, true, offset);
      drawDiagonal(-i * distanceLine + FW / 2, limit, -limit, true, -offset);
    }
    ctx.stroke();
    ctx.beginPath();
    for (var i = 1; i < FW / (distanceLine * 2); i++) {
      var offset = i * i * 5 + 25;
      setContextAtrribute(1);
      drawDiagonal(i * distanceLine + FW / 2, FH - limit, limit, true, offset);
      drawDiagonal(
        -i * distanceLine + FW / 2,
        FH - limit,
        limit,
        true,
        -offset,
      );
    }
    ctx.stroke();

    if (controlHelp) {
      displayWord("controls", 400, 130, 12, [0, 16]);
      displayWord("move             awsd", 400, 251, 12, [0, 0]);
      displayWord("fire       left click", 400, 290, 12, [0, 0]);
      displayWord("warptime  right click", 400, 330, 12, [0, 0]);
    } else {
      displayWord("winners don't use drugs", 400, 65, 9, [0, 0]);
      displayWord(
        "evil glitch",
        400,
        270 - fade * 50,
        30 * (1 + fade),
        [0, 9, 0, 9],
      );
      //displayWord('glitch', 400, 310+fade*50,20*(1+fade), [0,1,0]);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function updateSplash() {
    animationLine++;
    if (animationLine > distanceLine) {
      animationLine = 0;
    }
  }

  function startGame() {
    fade = 0.01;
  }

  function startGodMode() {
    startFromGodMode = true;
    startGame();
  }
  init();
  var bannerScreen = false;
  var bannerMessage = "";
  var bannerCounter = 0;
  function launchBanner(message, length) {
    GLITCHS[6] = 30;
    bannerCounter = length || 30;
    glitchTime = 10;
    bannerMessage = message;
  }

  function backToMenu() {
    play(heroSpeedUp);
    splashScreen = true;

    init();

    buttons[2][3] = "true";
    buttons[3][3] = "true";
    buttons[4][3] = godMode;
  }

  function drawBanner() {
    var widthSequence = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20];
    ctx.save();
    ctx.beginPath();
    setContextAtrribute(2, 1);
    ctx.fillRect(0, 0, FW, FH);
    displayWord(
      bannerMessage,
      430,
      180,
      bannerMessage.length < 5 ? 120 : 70,
      widthSequence,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  var endMessages = [
    "",
    "now i see",
    "i am creation",
    "you are destruction",
    "we are going to be",
    "in this battle",
    "forever",
  ];

  var endBannerCounter = 0;
  var bannerEndMessage;
  function updateEnds() {
    switch (endBannerCounter) {
      case 90:
        launchBanner("what", 30);
        break;
      case 120:
        launchBanner("have", 30);
        break;
      case 150:
        launchBanner("you", 30);
        break;
      case 180:
        launchBanner("done?", 120);
        break;
      case 185:
        GLITCHS = [100, 100, 100, 0, 0, 0, 0];
        break;
      case 215:
        GLITCHS = [100, 100, 100, 100, 100, 100, 100];
        sequence1.stop();
        sequence2.stop();
        sequence2.tempo = 1;
        sequence2.play();
        sequence3.stop();
        sequence3.tempo = 1;
        sequence3.play();
        sequence4.stop();
        break;
      case 320:
        sequence2.stop();
        sequence3.stop();
        sequence2.tempo = 138;
        sequence3.tempo = 138;
        bannerMessage = "";
        break;
      case 434:
        totemDieShakes = 0;
        break;
    }
    if (endBannerCounter > 435 && endBannerCounter < 1694) {
      bannerMessage = endMessages[~~((endBannerCounter - 435) / 180)];
    }
    if (endBannerCounter > 1694) {
      bannerEndMessage = false;
      score = 300000;
      wave = 7;
      enemies = [];
      bullets = [];
      godMode = true;
      storage.setItem("godMode", "qyui");
      loadGod();
    }
    endBannerCounter++;
  }
  function drawBannerEnds() {
    if (endBannerCounter < 300) return;
    var widthSequence = [0, 0, 0, 0];
    ctx.save();
    ctx.beginPath();
    if (endBannerCounter < 436) {
      setContextAtrribute(
        -1,
        1,
        "rgba(0,0,0," + (1 - (436 - endBannerCounter) / 120) + ")",
      );
      ctx.fillRect(0, 0, FW, FH);
    } else {
      setContextAtrribute(23, 1);
      ctx.fillRect(0, 0, FW, FH);
      displayWord(bannerMessage, 400, 250, 16, widthSequence);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function checkRecord() {
    newRecord = score > record;
    if (!newRecord) return;
    record = score;
    storage.setItem("record", score);
    buttons[1][3] = true;
    buttons[2][3] = true;
  }

  function getRandomValue(value, offset) {
    return Math.random() * (value || 1) + (offset || 0);
  }
  function randomSign() {
    return getRandomValue() > 0.5 ? 1 : -1;
  }
  function randomGlitch() {
    var tempDuration = getRandomValue(10, 5);
    GLITCHS = [
      tempDuration,
      tempDuration,
      tempDuration,
      getRandomValue(10, 5),
      getRandomValue(10, 5),
      getRandomValue(10, 5),
      0,
    ];
  }

  function toggleControls() {
    play(heroSpeedUp);
    controlHelp = !controlHelp;
    buttons[2][3] = !controlHelp;
    buttons[4][3] = !controlHelp && godMode;
    buttons[3][5] = controlHelp ? "go back" : "controls";
  }
  // x, y, width, visible, color, message, clicked, hover, action
  var buttons = [
    [250, 320, 300, false, 10, "start again", false, false, startGame],
    [250, 380, 300, false, 13, "back to menu", false, false, backToMenu],
    [240, 380, 320, true, 13, "fire to start", false, false, startGame],
    [280, 440, 240, true, 13, "controls", false, false, toggleControls],
    [280, 130, 240, godMode, 16, "evil mode", false, false, startGodMode],
  ];

  function drawButtons() {
    // absolute position
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      if (!button[3]) continue;
      var colorIndex = button[7] ? 14 : button[4];
      setContextAtrribute(colorIndex);
      setContextAtrribute(-1, 2, 2);
      ctx.strokeRect(button[0], button[1], button[2], 42);
      displayWord(button[5], button[0] + button[2] / 2, button[1] + 9, 12, [
        0,
        colorIndex,
      ]);
    }
  }

  function updateButtons() {
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      if (
        !button[3] ||
        coords[0] < button[0] ||
        coords[0] > button[0] + button[2] ||
        coords[1] < button[1] ||
        coords[1] > button[1] + 42
      ) {
        button[6] = button[7] = false;
        continue;
      }
      button[7] = true;
      if (coords[2] == 1) {
        button[6] = true;
      } else if (coords[2] == 0 && button[6]) {
        button[6] = false;
        button[8]();
      }
    }
  } // x, y, timeleft, baseTime, summonElement, baseanimation...
  var summons = [];

  function updateSummons() {
    for (var i = 0; i < summons.length; i++) {
      var summon = summons[i];
      summon[2] -= dt;
      if (summon[2] < 0) {
        enemies.push(createEnemy(summon[4]));
        if (summon[4][2] > 9) {
          glitchTime = 10;
          play(totemAppears);
        }
        if (summon[4][2] == 3) {
          bigKiller = enemies[enemies.length - 1];
        }
        summons.splice(i, 1);
      }
    }
  }

  function drawSummonBoss(x, y, percentage, size) {
    ctx.translate(x, y);
    ctx.beginPath();
    setContextAtrribute(-1, 1, "rgba(210,0,0,0.9)");
    ctx.arc(0, 0, mapPixels * (1 - percentage), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.beginPath();
    setContextAtrribute(0);
    if (percentage < 0.3) {
      ctx.moveTo((-size * percentage) / 0.3, 0);
      ctx.lineTo((size * percentage) / 0.3, 0);
    } else {
      setContextAtrribute(0, 1);
      ctx.bezierCurveTo(-size, 0, 0, (-size * percentage) / 3.5, size, 0);
      ctx.bezierCurveTo(size, 0, 0, (size * percentage) / 3.5, -size, 0);
      ctx.fill();
    }
    ctx.closePath();
    ctx.translate(-x, -y);
  }

  function drawSummons() {
    ctx.beginPath();
    for (var i = 0; i < summons.length; i++) {
      var summon = summons[i];
      var enemyType = summon[4][2];
      var size = necronomicon[enemyType][0];
      var percentage = easeOutQuad(summon[2], 1, -1, summon[3]);
      var x = summon[0] + viewPort[0] + shakeScreen[0];
      var y = summon[1] + viewPort[1] + shakeScreen[1];
      if (enemyType == 14) {
        drawSummonBoss(x, y, percentage, size);
        continue;
      }
      setContextAtrribute(-1, 0, "rgba(38,82,255," + percentage + ")");
      ctx.fillRect(
        x - percentage * size,
        y - percentage * size,
        percentage * size * 2,
        percentage * size * 2,
      );
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function scheduleSummon(x, y, time, element) {
    if (element[2] == 14) {
      time *= 2;
      play(bossSummon);
    }
    summons.push([x, y, time, time, element]);
  }

  var alSequence = [10, 10, 11, 11, 11, 12, 12, 10, 10, 11, 13, 10, 11, 12, 12];
  var alIndex = 0;

  function updateTrigger() {
    if (times.length > 0 && score > times[0]) {
      var trigger = triggers[times.splice(0, 1)[0]];
      var type = trigger.splice(0, 1)[0];
      switch (type) {
        case 0:
          trigger[0] = (trigger[0] + 0.5) * tileset;
          trigger[1] = (trigger[1] + 0.5) * tileset;
          scheduleSummon(trigger[0], trigger[1], 1, trigger);
          break;
        case 1:
          trigger[0].play();
          break;
        case 2:
          GLITCHS = trigger;
          break;
        case 3:
          play(trigger[0]);
          break;
        case 4:
          trigger[0].tempo = trigger[1];
          if (trigger[1] == 138) {
            trigger[0].stop();
            trigger[0].play();
          }
          break;
        case 5:
          message = trigger[0];
          break;
        case 6:
          launchBanner(trigger[0]);
          break;
        case 7:
          trigger[0].stop();
          break;
        case 8:
          wave = trigger[0];
          break;
      }
    } else if (times.length == 0) {
      // to infinite mode
      if (alIndex++ >= alSequence.length) {
        alIndex = 0;
      }
      triggers[score + 5000] = [
        0,
        ~~getRandomValue(21),
        ~~getRandomValue(21),
        alSequence[alIndex],
      ];
      times.push(score + 5000);
    }
  } //corrupt algorithm
  function corruptZone(x, y, radius) {
    var col = ~~(x / tileset);
    var row = ~~(y / tileset);
    var r = Math.ceil(radius / tileset);
    for (var j = row - r; j < row + r; j++) {
      if (typeof map[j] == "undefined") continue;
      for (var i = col - r; i < col + r; i++) {
        if (
          map[j][i] == 1 ||
          getHypo((j + 0.5) * tileset - y, (i + 0.5) * tileset - x) >= radius
        )
          continue;
        map[j][i] = 1;
      }
    }
  }

  function removeCorruption(x, y, radius) {
    var col = ~~(x / tileset);
    var row = ~~(y / tileset);
    var r = Math.ceil(radius / tileset);
    for (var j = row - r; j < row + r; j++) {
      if (typeof map[j] == "undefined") continue;
      for (var i = col - r; i < col + r; i++) {
        if (
          map[j][i] == 1 ||
          getHypo((j + 0.5) * tileset - y, (i + 0.5) * tileset - x) <= radius
        ) {
          map[j][i] = 0;
        }
      }
    }
  }
  var necronomicon = [
    // normal enemies
    //size, angle, summonTime, type, hits, xpoints, ypoints, customData:angleTarget, customData: angleMomentum, anglediff, speed
    // 0: basic square
    [15, 0, 0, 0, 1, [1, 0.25, -1, 0.25], [0, -0.75, 0, 0.75], 0, 3, 0.1, 1.1],
    // 1: simple killer
    [
      15,
      0,
      0,
      1,
      4,
      [1, 0.3, 0, -2, 0, 0.3],
      [0, 1, 0.3, 0, -0.3, -1],
      0,
      3,
      0.05,
      0.8,
    ],
    // 2: follower
    [8, 0, 0, 2, 2, [1, 0.25, -1, 0.25], [0, -0.5, 0, 0.5], 0, 3.5, 0.15, 1.6],
    // 3: heavy killer
    [
      20,
      0,
      0,
      3,
      9,
      [
        0, 0.25, 0.75, 0.75, 1, 0.75, 0.75, 0.25, 0, -0.25, -0.75, -0.75, -1,
        -0.75, -0.75, -0.25,
      ],
      [
        -1, -0.75, -0.75, -0.25, 0, 0.25, 0.75, 0.75, 1, 0.75, 0.75, 0.25, 0,
        -0.25, -0.75, -0.75,
      ],
      0,
      1,
      0.12,
      1.05,
    ],
    //4: guardian
    [
      12,
      0,
      0,
      4,
      5,
      [0, 0.25, 1, 0.25, 0, -0.25, -1, -0.25],
      [-1, -0.25, 0, 0.25, 1, 0.25, 0, -0.25],
      0,
      3,
      0.03,
      2.5,
      0,
      0,
      0,
    ], // last two parameters, x y to turnon radiis
    //5: bullet basic triangle
    [3, 0, 0, 5, 150, [1, -1, -1], [0, 1, -1], 0, 0, 0, 1.4], // last two parameters, x y to turnon radiis
    //6: totem seed - countdown=13
    [
      16,
      0,
      0,
      6,
      9,
      [1, 0.25, -1, 0.25],
      [0, -0.75, 0, 0.75],
      0,
      0,
      0,
      0.6,
      3.5,
    ],
    //7: totem seed - countdown=13
    [
      18,
      0,
      0,
      7,
      8,
      [1, 0.25, -1, 0.25],
      [0, 0.75, 0, -0.75],
      0,
      0,
      0,
      0.8,
      2.5,
    ],
    //8: nothing decided
    [
      20,
      0,
      0,
      8,
      7,
      [1, 0.25, -1, 0.25],
      [0, 0.75, 0, -0.75],
      0,
      0,
      0,
      1.2,
      1.5,
    ],
    ,
    //9: nothing decided
    // spawners 10 -- por si acaso
    //size, angle, hitEffect, type, hits, xpoints, ypoints, customData:nextInvocation, corruptionPower, corruptionRatio
    //pyramid solid
    [
      tileset / 2,
      0,
      0,
      10,
      9,
      [
        [-1, 0, 0],
        [0, 0, 1],
        [-1, 1, 0],
      ],
      [
        [-1.5, -0.5, 0.5],
        [-0.5, 0.5, -1.5],
        [-1.5, -1.5, -0.5],
      ],
      100,
      0,
      7,
    ],
    //cube solid
    [
      tileset / 2,
      0,
      0,
      11,
      10,
      [
        [-1, 0, 0, -1],
        [1, 0, 0, 1],
        [-1, 0, 1, 0],
        [-1, 0, 1, 0],
        [-1, 0, 0, -1],
        [1, 0, 0, 1],
      ],
      [
        [-1.25, -0.5, 0.8, 0.25],
        [-1.25, -0.5, 0.8, 0.25],
        [-1.25, -0.5, -1.25, -1.8],
        [0.25, -0.5, 0.25, 0.8],
        [0.25, -0.5, -1.8, -1.25],
        [0.25, -0.5, -1.8, -1.25],
      ],
      100,
      0,
      6,
    ],
    //prism solid
    [
      tileset * 0.8,
      0,
      0,
      12,
      15,
      [
        [-0.5, 0, 0.5, 0],
        [-0.5, 0, 0],
        [0.5, 0, 0],
        [-0.5, 0, 0],
        [0.5, 0, 0],
      ],
      [
        [-0.75, -1, -0.75, -0.5],
        [-0.75, -0.5, 0.25],
        [-0.75, -0.5, 0.25],
        [-0.75, -1.75, -0.5],
        [-0.75, -1.75, -0.5],
      ],
      0.9,
      0,
      4,
      0.004,
    ],
    // st
    [
      tileset * 1.2,
      0,
      0,
      13,
      50,
      [
        [0, -0.75, 0],
        [0, 0.75, 0],
        [-0.75, 0.75, 0],
        [-0.75, 0.75, 0],
        [-0.35, 0.35, 0],
      ],
      [
        [-1, 0.5, 0],
        [-1, 0.5, 0],
        [0.5, 0.5, 0],
        [-0.5, -0.5, 1],
        [0.25, 0.25, -0.5],
      ],
      0.9,
      0,
      13,
      0.1,
    ],
    // flower of fucking life - summon counter=13
    [
      tileset * 2.5,
      0,
      0,
      14,
      200,
      [],
      [],
      0.9,
      0,
      60,
      0.003,
      1,
      0,
      [6, 7, 6, 7, 8],
    ],
  ];

  var invocationTimes = {
    10: 2800,
    11: 2600,
    12: 60,
    13: 200,
  };

  var totemDieShakes = 0;

  function summonGuardian(enemy, j) {
    var newEnemy = createEnemy([
      enemy[0] + Math.cos((Math.PI * j) / 3) * 10,
      enemy[1] + Math.sin((Math.PI * j) / 3) * 10,
      4,
    ]);
    newEnemy[13] = enemy;
    newEnemy[9] = getAngle(newEnemy, enemy);
    newEnemy[3] = newEnemy[9] + enemy[11];
    newEnemy[15] = 0;
    newEnemy[16] = 0;
    enemies.push(newEnemy);
  }

  // values: x, y, type
  function createEnemy(values) {
    var enemy = values.slice(0, 2).concat(necronomicon[values[2]].slice(0));

    if (enemy[5] == 12 || enemy[5] == 14) {
      for (var j = 0; j < 6; j++) {
        summonGuardian(enemy, j);
      }
    }
    // for (var j = 0; j<12; j++) { for the last enemy
    // var newEnemy = createEnemy([enemy[0]+Math.cos(Math.PI*2*j/12+0.1)*10,enemy[1]+Math.sin(Math.PI*2*j/12+0.1)*10, 4])
    return enemy;
  }

  //draw methods

  function drawFace(xPath, yPath, size, index, color) {
    ctx.beginPath();
    var value = 125 - index * 20;
    setContextAtrribute(-1, 1, "rgba(" + color + ")");
    path(xPath, yPath, size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function pathEnemy(enemy) {
    ctx.rotate(enemy[9]);
    path(enemy[7], enemy[8], enemy[2]);
    //ctx.strokeRect(enemy[7][0], enemy[8][1], enemy[2]*2, enemy[2]*2)
    ctx.rotate(-enemy[9]);
  }
  var flowerOfpoints = [];
  for (var i = 0; i < 6; i++) {
    var angle = ((i - 3) * Math.PI) / 3 + Math.PI / 6;
    var x = Math.cos(angle);
    var y = Math.sin(angle);
    flowerOfpoints.push(x, y);
  }
  function drawFlowerOfLife(enemy) {
    var color = "hsla(" + enemy[3] * 20 + ",50%,60%, 0.5)";
    setContextAtrribute(-1, 2, 2);
    ctx.beginPath();
    setContextAtrribute(-1, 0, enemy[4] > 0 ? colors[3] : color);
    var relativeSize = enemy[2] / 3.5;
    ctx.arc(0, 0, relativeSize / 2, 0, Math.PI * 2, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.bezierCurveTo(-relativeSize, 0, 0, -relativeSize, relativeSize, 0);
    ctx.bezierCurveTo(relativeSize, 0, 0, relativeSize, -relativeSize, 0);
    ctx.stroke();
    ctx.rotate(enemy[3]);
    for (var i = 0; i < 6; i++) {
      var x = flowerOfpoints[i * 2];
      var y = flowerOfpoints[i * 2 + 1];
      var angle = ((i - 3) * Math.PI) / 3;
      ctx.beginPath();
      ctx.arc(
        4 * x * relativeSize,
        4 * y * relativeSize,
        relativeSize,
        0,
        Math.PI * 2,
        false,
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(
        2 * x * relativeSize,
        2 * y * relativeSize,
        relativeSize,
        0,
        Math.PI * 2,
        false,
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x * relativeSize * 4, y * relativeSize * 4);
      ctx.lineTo(
        relativeSize * 4 * flowerOfpoints[(i * 2 + 2) % 12],
        relativeSize * 4 * flowerOfpoints[(i * 2 + 3) % 12],
      );
      ctx.lineTo(
        relativeSize * 4 * flowerOfpoints[(i * 2 + 6) % 12],
        relativeSize * 4 * flowerOfpoints[(i * 2 + 7) % 12],
      );
      ctx.moveTo(x * relativeSize * 2, y * relativeSize * 2);
      ctx.lineTo(
        relativeSize * 2 * flowerOfpoints[(i * 2 + 2) % 12],
        relativeSize * 2 * flowerOfpoints[(i * 2 + 3) % 12],
      );
      ctx.lineTo(
        relativeSize * 2 * flowerOfpoints[(i * 2 + 6) % 12],
        relativeSize * 2 * flowerOfpoints[(i * 2 + 7) % 12],
      );
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.rotate(-enemy[3]);
  }

  // greater the percentage blink fast
  function blink(percentage, i) {
    if (percentage > 0.99) return 1;
    var value = percentage * 100;
    var umbral = 1 / percentage;
    return value % umbral > umbral / 2 ? 1 : 0;
  }
  var blinkValues = {};
  for (var i = 0; i < 10000; i++) {
    blinkValues[(i / 10000).toFixed(4)] = blink(i / 10000, i);
  }

  function pathTotem(totem) {
    var loading =
      (invocationTimes[totem[5]] - totem[9]) / invocationTimes[totem[5]];
    var green =
      totem[4] > 0 ? -55 : ~~(200 * loading) * blinkValues[loading.toFixed(4)];
    //setContextAtrribute(totem[4]>0?15:green==0?16:17)
    setContextAtrribute(16);
    for (var i = 0; i < totem[7].length; i++) {
      drawFace(totem[7][i], totem[8][i], totem[2], i, [
        80 + totem[4],
        55 + green,
        130 + ~~(green / 2),
        totem[4] > 0 ? 0.9 : 0.2,
      ]);
    }
  }

  function drawEnemy(enemy) {
    if (
      enemy[0] + viewPort[0] < 20 ||
      enemy[0] + viewPort[0] > W - 20 ||
      enemy[1] + viewPort[1] < 20 ||
      enemy[1] + viewPort[1] > H - 20
    )
      return;
    var offsetX =
      enemy[0] + viewPort[0] + shakeScreen[0] + (randomSign() * enemy[4]) / 40; // 20 /2 width/2
    var value =
      enemy[5] > 9 ? Math.sin((frame / 50) % (Math.PI * 2)) * 5 + 5 : 0;
    var offsetY =
      enemy[1] +
      viewPort[1] +
      shakeScreen[1] +
      (randomSign() * enemy[4]) / 40 -
      value;
    ctx.translate(offsetX, offsetY);
    ctx.beginPath();
    if (enemy[5] < 10) {
      setContextAtrribute(enemy[5] + 24); //temporal
      //setContextAtrribute(-1,0,'hsla('+enemy[5]*36+',50%,60%,0.8)');
      setContextAtrribute(-1, 2, 2);
      pathEnemy(enemy);
    } else if (enemy[5] == 14) {
      drawFlowerOfLife(enemy, 1);
    } else {
      setContextAtrribute(-1, 2, 2);
      pathTotem(enemy);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.translate(-offsetX, -offsetY);
  }

  var spawns = {
    10: function (enemy) {
      for (var j = 0; j < 9; j++) {
        if (j == 4) continue; //summon especial
        var x = enemy[0] + ((j % 3) - 1) * tileset;
        var y = enemy[1] + (~~(j / 3) - 1) * tileset;
        scheduleSummon(x, y, 0.65, [x, y, j == 1 ? 1 : 0]);
        //var newEnemy = createEnemy([enemy[0]+(j%3-1)*tileset,enemy[1]+(~~(j/3)-1)*tileset, j==1?1:0])
        //enemies.push(newEnemy);
      }
      enemy[9] = invocationTimes[10]; // time to summon again
    },
    11: function (enemy) {
      for (var j = 0; j < 12; j++) {
        if (j == 4) continue; //summon especial
        var x = enemy[0] + ((j % 3) - 1) * tileset;
        var y = enemy[1] + (~~(j / 3) - 1) * tileset;
        scheduleSummon(x, y, 0.65, [x, y, j == 1 ? 3 : 2]);

        //if(j==1) bigKiller = newEnemy;
        //enemies.push(newEnemy);
      }
      enemy[9] = invocationTimes[11];
    },
    12: function (enemy) {
      //
      for (var i = 0; i < 2; i++) {
        var newEnemy = createEnemy([enemy[0], enemy[1], 5]);
        newEnemy[9] = enemy[3] + i * Math.PI;
        enemies.push(newEnemy);
      }
      enemy[9] = invocationTimes[12]; //crazy  0.3
    },
    13: function (enemy) {
      for (var i = 0; i < 6; i++) {
        var newEnemy = createEnemy([enemy[0], enemy[1], 5]);
        newEnemy[9] = enemy[3] + ((i - 3) * Math.PI) / 3;
        newEnemy[12] += 0.5;
        enemies.push(newEnemy);
      }
      enemy[9] = 45;
    },
    14: function (enemy) {
      for (var i = 0; i < 6; i++) {
        var newEnemy = createEnemy([enemy[0], enemy[1], 5]);
        newEnemy[9] = enemy[3] + ((i - 3) * Math.PI) / 3 + Math.PI / 6;
        newEnemy[12] -= 0.6;
        enemies.push(newEnemy);
      }
      if (enemy[13] % 16 == 0) {
        var newEnemy = createEnemy([
          enemy[0],
          enemy[1],
          enemy[15][enemy[14] % enemy[15].length],
        ]);
        newEnemy[9] = enemy[3] / 2;
        enemies.push(newEnemy);
        enemy[14]++;
      }
      if (enemy[13] % 100 == 0) {
        for (var j = 0; j < 6; j++) {
          summonGuardian(enemy, j);
        }
      }
      enemy[9] = 70;
      enemy[13]++;
    },
  };

  // update methods
  function updateEnemy(enemy, index) {
    // have zero life
    if (enemy[6] <= 0) {
      enemies.splice(index, 1);
      if (enemy[5] == 5) return;
      if (enemy[5] == 14) {
        bannerEndMessage = true;
      }
      createParticles(
        enemy[0],
        enemy[1],
        enemy[2],
        necronomicon[enemy[5]][0],
        necronomicon[enemy[5]][0] * 2,
        enemy[5] + 24,
      );
      if (enemy[5] > 9) {
        removeCorruption(enemy[0], enemy[1], enemy[10]);
        totemDieShakes = 4;
        play(totemDestroyed);
      } else {
        play(enemyDie);
      }
      return;
    }

    if (enemy[4] > 0) {
      enemy[4] -= 50;
    }
    // miniom
    if (enemy[5] < 10) {
      if (enemy[10] * (enemy[9] - enemy[3]) > 0) {
        if (enemy[5] == 2) {
          //follower
          enemy[3] = getAngle(enemy, bigKiller || [0, 0]);
        } else if (enemy[5] == 4) {
          enemy[3] += enemy[9] + enemy[11];
        } else {
          enemy[3] = getAngle(enemy, hero);
        }
        enemy[10] = enemy[3] > enemy[9] ? enemy[11] : -enemy[11];
      }

      var otherEnemy = collideElements(enemy);
      if (enemy[5] == 4) {
        enemy[9] += enemy[10] * t;
      } else if (enemy[5] != 3 || (otherEnemy && otherEnemy[5] == 3)) {
        //type 3 dont collide with followers and collide with himself
        enemy[9] += (otherEnemy ? -1 : 1) * enemy[10];
      } else {
        enemy[9] += enemy[10];
      }

      if (enemy[5] == 5) {
        enemy[6] -= t / 10;
      }

      if (enemy[5] > 5 && enemy[5] < 10) {
        enemy[13] -= dt;
        if (enemy[13] < 0) {
          var coords = [
            (~~(enemy[0] / tileset) + 0.5) * tileset,
            (~~(enemy[1] / tileset) + 0.5) * tileset,
            enemy[5] + 4,
          ];
          scheduleSummon(coords[0], coords[1], 1, coords);
          enemies.splice(index, 1);
          return;
        }
      }

      if (enemy[5] != 4) {
        enemy[0] += Math.cos(enemy[9]) * t * enemy[12];
        enemy[1] += Math.sin(enemy[9]) * t * enemy[12];
      } else {
        // guardians moves
        if (enemy[13][6] < 1) {
          enemy[10] *= 0.99;
        }
        enemy[15] = tileset * 2 * (-Math.cos(enemy[16]) + 1.2);
        enemy[16] += t / 200;
        enemy[0] = enemy[13][0] + Math.cos(enemy[9]) * enemy[15];
        enemy[1] = enemy[13][1] + Math.sin(enemy[9]) * enemy[15];
      }

      // spawner
    } else {
      enemy[9] -= t;
      if (enemy[5] >= 12) enemy[3] += enemy[12] * t;
      if (enemy[9] < 0 && !gameOver) {
        spawns[enemy[5]](enemy);
      }
      enemy[10] += dt * enemy[11];
      corruptZone(enemy[0], enemy[1], enemy[10]);
    }
    addItem(enemy);
  }
  /**
   * read the last events in game, update world
   */

  function die(killer) {
    play(heroDie);
    createParticles(hero[0], hero[1], hero[2], 10, 80, 6);
    heroShape = [[], []];
    gameOver = true;
    sequence1.stop();
    sequence2.stop();
    sequence3.stop();
    sequence4.stop();
    buttons[0][3] = true;
    buttons[1][3] = true;
    t = dt * 30;
    checkRecord();
    frame = 0;
  }

  function drawPointer() {
    ctx.save();
    ctx.beginPath();
    setContextAtrribute(-1, 2, 2);
    ctx.translate(coords[0], coords[1]);
    setContextAtrribute(6);
    ctx.translate(-10, -10);
    crossLine(10, 0, 20);
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  }

  function playerUdate(dt) {
    // apply speed to hero movement
    t = dt * hero[4] * (hero[8] > 0 ? slowMotion : 1);
    // move depending on keypressed
    var speed = dt * hero[4] * (hero[8] > 0 ? 1.4 : 1);
    if (
      map[Math.round(hero[1] / tileset)] &&
      map[Math.round(hero[1] / tileset)][Math.round(hero[0] / tileset)] == 1
    ) {
      speed -= 0.5;
    }
    if (keyMap & keys[65]) {
      hero[0] -= speed;
      if (hero[0] < hero[2]) hero[0] = hero[2]; // hero limit on x left
      if (hero[0] > viewPort[2] && hero[0] < mapPixels - viewPort[2])
        viewPort[0] += speed;
      if (viewPort[0] > 32) viewPort[0] = 32;
    }
    if (keyMap & keys[87]) {
      hero[1] -= speed;
      if (hero[1] < hero[2]) hero[1] = hero[2];
      if (hero[1] > viewPort[3] && hero[1] < mapPixels - viewPort[3])
        viewPort[1] += speed;
      if (viewPort[1] > 27) viewPort[1] = 27;
    }

    if (keyMap & keys[83]) {
      hero[1] += speed;
      if (hero[1] > mapPixels - hero[2]) hero[1] = mapPixels - hero[2];
      if (hero[1] > viewPort[3] && hero[1] < mapPixels - viewPort[3])
        viewPort[1] -= speed;
      if (viewPort[1] < -272) viewPort[1] = -272;
    }
    if (keyMap & keys[68]) {
      hero[0] += speed;
      if (hero[0] > mapPixels - hero[2]) hero[0] = mapPixels - hero[2];
      if (hero[0] > viewPort[2] && hero[0] < mapPixels - viewPort[2])
        viewPort[0] -= speed;
      if (viewPort[0] < -67) viewPort[0] = -67;
    }

    hero[3] = getAngle([hero[0] + viewPort[0], hero[1] + viewPort[1]], coords);

    hero[5] += t * 25 * (coords[2] * 8 + 1);
    hero[5] %= 360;

    var killer = collideElements(hero);
    if (killer) die(killer);
    // if fire shots fire
    if (coords[2] && hero[6] <= 0 && hero[8] <= 0) {
      bullets.push([
        hero[0] + shake(1, 2 + hero[7] / 30),
        hero[1] + shake(1, 2 + hero[7] / 30),
        2,
        hero[3] + shake(1, 0.05 + 0.001 * hero[7]),
      ]);
      play(fireSounds[~~getRandomValue(fireSounds.length)]);
      hero[6] = 1 / hero[7]; //12bullets per second
    } else {
      hero[6] -= dt;
    }

    if (coords[3] && hero[8] <= 0 && hero[9] <= 0) {
      play(heroSpeedUp);
      hero[8] = 0.55;
      hero[9] = 1.2;
    } else {
      hero[8] -= dt;
      hero[9] -= dt;
    }
  }

  function update(dt) {
    if (!gameOver) playerUdate(dt);

    // update bullets
    bulletsCycle: for (var i = bullets.length - 1; i >= 0; i--) {
      var bullet = bullets[i];
      bullet[0] += Math.cos(bullet[3]) * t * bullet[2]; // bullet speed *2
      bullet[1] += Math.sin(bullet[3]) * t * bullet[2];
      if (
        bullet[0] < -20 ||
        bullet[0] > mapPixels + 20 ||
        bullet[1] < -20 ||
        bullet[1] > mapPixels + 20
      )
        bullets.splice(i, 1);

      var enemy = collideElements(bullet);
      if (enemy) {
        if (--enemy[6] > 0) {
          createParticles(bullet[0], bullet[1], -bullet[3], 2, 10, 9);
        }
        bullets.splice(i, 1);
        enemy[4] = 200;
        if (enemy[5] > 9) play(hitSounds[~~getRandomValue(hitSounds.length)]);
      }
    }

    //update particles
    for (var i = 0; i < particles.length; i++) {
      var particle = particles[i];
      particle[0] += Math.cos(particle[2]) * getRandomValue(3, 2);
      particle[1] += Math.sin(particle[2]) * getRandomValue(3, 2);
      if (--particle[3] < 0) particles.splice(i, 1);
    }

    // update enemies
    if (totemDieShakes > 0) totemDieShakes -= 0.1;
    spatialhashing = {};
    for (var i = enemies.length - 1; i >= 0; i--) {
      updateEnemy(enemies[i], i);
    }
    updateTrigger();
    updateSummons();
  }

  function shake(cond, val) {
    return cond ? getRandomValue(val * 2, -val) : 0;
  }

  /**
helper function to draw paths. 
*/
  function path(xpts, ypts, size) {
    ctx.moveTo(xpts[0] * size, ypts[0] * size);
    for (var i = 1; i < xpts.length; i++) {
      ctx.lineTo(xpts[i] * size, ypts[i] * size);
    }
    ctx.lineTo(xpts[0] * size, ypts[0] * size);
  }

  function createParticles(x, y, angle, many, life, color) {
    for (var h = -many; h < many; h++) {
      particles.push([
        x,
        y,
        getRandomValue(particleZ * h, angle),
        life || 60,
        color,
      ]);
    }
  }

  function draw(t) {
    // draw map
    //some random points
    setContextAtrribute(7, 1);
    ctx.fillRect(0, 0, FW, FH);
    setRandomColor(180, 0, 185, 0, 185, 0, 0, 1);
    for (var i = 0; i < 6; i++)
      ctx.fillRect(~~getRandomValue(800), ~~getRandomValue(600), 2, 2);

    // draw map
    ctx.save();
    var gridSize = H / mapSize;
    ctx.beginPath();
    shakeScreen = !gameOver
      ? [
          shake(coords[2] || totemDieShakes > 0, totemDieShakes + 2),
          shake(coords[2] || totemDieShakes > 0, totemDieShakes + 2),
        ]
      : [0, 0];
    setContextAtrribute(
      -1,
      1,
      "rgba(7,8,12," + (0.2 - (hero[8] > 0 ? 0.1 : 0)) + ")",
    );
    ctx.translate(viewPort[0] + shakeScreen[0], viewPort[1] + shakeScreen[1]);
    ctx.fillRect(0, 0, mapPixels, mapPixels);

    setContextAtrribute(1);
    ctx.beginPath();
    for (var i = 0; i <= mapSize; i++) {
      crossLine(i * tileset - 0.5, 0, mapPixels);
    }
    ctx.stroke();
    ctx.beginPath();
    setContextAtrribute(5);
    for (var i = 0; i <= mapSize; i++) {
      crossLine(i * tileset + 0.5, 0, mapPixels);
    }
    ctx.stroke();
    ctx.restore();

    // draw corruption
    ctx.save();
    ctx.beginPath();
    setContextAtrribute(8, 1); //fillstyle
    setContextAtrribute(2); //stroke style
    for (var j = 0; j < mapSize; j++) {
      for (var i = 0; i < mapSize; i++) {
        if (map[j][i] == 0) continue;
        ctx.fillRect(
          i * tileset + viewPort[0] + shakeScreen[0],
          j * tileset + viewPort[1] + shakeScreen[1],
          tileset,
          tileset,
        );
        ctx.strokeRect(
          i * tileset + viewPort[0] + shakeScreen[0] - 0.5,
          j * tileset + viewPort[1] + shakeScreen[1] - 0.5,
          tileset + 2,
          tileset + 2,
        );
        //ctx.strokeRect(i*tileset+viewPort[0]+shakeScreen[0]+1.5, j*tileset+viewPort[1]+shakeScreen[1]+1.5, tileset-2, tileset-2);
      }
    }
    ctx.stroke();
    ctx.beginPath();
    setContextAtrribute(2);
    for (var j = 0; j < mapSize; j++) {
      for (var i = 0; i < mapSize; i++) {
        if (map[j][i] == 0) continue;
        ctx.strokeRect(
          i * tileset + viewPort[0] + shakeScreen[0] + 0.5,
          j * tileset + viewPort[1] + shakeScreen[1] + 0.5,
          tileset,
          tileset,
        );
      }
    }
    ctx.fill();
    ctx.closePath();
    ctx.restore();

    // draw summons
    ctx.save();
    drawSummons();
    ctx.restore();

    // draw hero
    ctx.save();
    ctx.translate(hero[0] + viewPort[0], hero[1] + viewPort[1]);
    ctx.rotate(hero[3] + Math.PI / 2);
    // strokeWidth to 3
    setContextAtrribute(-1, 2, 2);
    // strokeStyle to colors[6]
    setContextAtrribute(6);
    ctx.beginPath();
    path(heroShape[0], heroShape[1], hero[2]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // draw enemies
    ctx.save();
    for (var i = 0; i < enemies.length; i++) {
      drawEnemy(enemies[i]);
    }
    ctx.closePath();
    ctx.restore();

    // draw bullets
    ctx.save();
    setContextAtrribute(9, 1); //fill
    for (var i = 0; i < bullets.length; i++) {
      var bullet = bullets[i];
      if (
        bullet[0] + viewPort[0] < 20 ||
        bullet[0] + viewPort[0] > W - 20 ||
        bullet[1] + viewPort[1] < 20 ||
        bullet[1] + viewPort[1] > H - 20
      )
        continue;
      ctx.beginPath();
      ctx.arc(
        bullet[0] + viewPort[0],
        bullet[1] + viewPort[1],
        bullet[2],
        0,
        2 * Math.PI,
        false,
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    //draw particles
    ctx.save();
    //setRandomColor(125,50, 125,50,125,50,0,1);
    //  setContextAtrribute(1)
    for (var i = 0; i < particles.length; i++) {
      var particle = particles[i];
      if (
        particle[0] + viewPort[0] < 5 ||
        particle[0] + viewPort[0] > W - 5 ||
        particle[1] + viewPort[1] < 5 ||
        particle[1] + viewPort[1] > H - 5
      )
        continue;
      ctx.beginPath();
      //ctx.globalAlpha = particle[3]/100;
      setContextAtrribute(particle[4], 1);
      //setRandomColor(125,particle[4], 125,particle[5],125,particle[6],0,particle[3]/100);
      ctx.arc(
        particle[0] + viewPort[0] + shakeScreen[0],
        particle[1] + viewPort[1] + shakeScreen[1],
        2,
        0,
        2 * Math.PI,
        false,
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // ui
    ctx.save();
    displayWord(message, 401, 501, 14, [26, 21, 21]);
    //displayWord(viewPort[0]+' '+viewPort[1], 402, 100,14, '#D6AE45');
    if (gameOver) {
      setContextAtrribute(22, 1);
      ctx.fillRect(0, 0, mapPixels, mapPixels);
      if (godMode) {
        displayWord("evil mode", 400, 80, 22, [0, 16]);
      }
      if (newRecord) {
        displayWord("-new record-", 400, 240, 22, [10, 18]);
      } else {
        displayWord("game over", 400, 240, 20, [0, 13]);
      }
      displayWord(score.toFixed(0), 400, 160, newRecord ? 20 : 16, [0, 9]);
    } else {
      //wave
      displayWord(wave > 6 ? "evil" : wave + "/6", 400, 60, 9, [0, 3]);
      //score
      displayWord(score.toFixed(0), 750, 60, 18, [32, 9], 1);
      //record
      var lrd = score > record ? "record" : record.toFixed(0);
      displayWord(lrd, 750, 110, 9, [24, 3], 1);
    }
    ctx.restore();
  }

  var lastTime;
  function loop(t) {
    if (!lastTime) lastTime = t;
    dt = Math.min(100, t - lastTime) / 1000;
    lastTime = t;
    frame++;

    // update changes
    if (splashScreen) updateSplash(dt);
    else if (bannerEndMessage) updateEnds();
    else if (GLITCHS[6] < 0) update(dt);

    if (splashScreen || gameOver) {
      switch (frame) {
        case 240:
        case 280:
        case 500:
          randomGlitch();
          play(openingGlitch);
          break;
        case 700:
          frame = 0;
          break;
      }
    }

    //update buttons
    updateButtons();

    // draw changes
    ctx.save();
    // draw game
    if (splashScreen) drawSplash();
    else if (!bannerScreen) draw(dt);

    // draw buttons
    if (!bannerScreen && !bannerEndMessage) drawPointer();
    ctx.save();
    drawButtons();
    ctx.restore();
    if (bannerScreen) drawBanner();
    else if (bannerEndMessage) drawBannerEnds();

    if (fade > 0) {
      fade += 0.05;
      if (fade == 0.51) play(gameStarts);
    }
    if (fade > 1) {
      splashScreen = false;
      fade = 0;
      init();
    }
    if (fade > 0 && fade < 1) {
      setContextAtrribute(-1, 1, "rgba(220,220,220," + fade + ")");
      ctx.fillRect(0, 0, FW, FH);
    }
    bannerScreen = bannerCounter > 0;
    if (bannerScreen) {
      bannerCounter -= 1;
    }

    ctx.restore();

    drawPostProcessing(~~t);
    if (!gameOver && !splashScreen)
      score += dt * 1000 * (hero[8] > 0 ? slowMotion : 1);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
