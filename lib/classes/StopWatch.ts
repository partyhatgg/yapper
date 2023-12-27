// Copyright (c) 2019 dirigeants, MIT License

import { performance } from "node:perf_hooks";

/**
 * Our Stopwatch class, uses native node to replicate/extend previous performance now dependency.
 */
export default class Stopwatch {
	/**
	 * The number of digits to appear after the decimal point when returning the friendly duration.
	 */
	public digits: number;

	private _start: number;

	private _end?: number | undefined;

	/**
	 * Starts a new Stopwatch
	 *
	 * @param [digits] The number of digits to appear after the decimal point when returning the friendly duration
	 */
	public constructor(digits = 2) {
		this.digits = digits;
		this._start = performance.now();
		this._end = undefined;
	}

	/**
	 * The duration of this stopwatch since start or start to end if this stopwatch has stopped.
	 */
	private get duration() {
		return this._end ? this._end - this._start : performance.now() - this._start;
	}

	/**
	 * If the stopwatch is running or not
	 */
	private get running() {
		return Boolean(!this._end);
	}

	/**
	 * Restarts the Stopwatch (Returns a running state)
	 */
	public restart() {
		this._start = performance.now();
		this._end = undefined;
		return this;
	}

	/**
	 * Resets the Stopwatch to 0 duration (Returns a stopped state)
	 */
	public reset() {
		this._start = performance.now();
		this._end = this._start;
		return this;
	}

	/**
	 * Starts the Stopwatch
	 */
	public start() {
		if (!this.running) {
			this._start = performance.now() - this.duration;
			this._end = undefined;
		}

		return this;
	}

	/**
	 * Stops the Stopwatch, freezing the duration
	 */
	public stop() {
		if (this.running) this._end = performance.now();
		return this;
	}

	/**
	 * Defines toString behavior
	 */
	public toString() {
		const time = this.duration;
		if (time >= 1_000) return `${(time / 1_000).toFixed(this.digits)}s`;
		if (time >= 1) return `${time.toFixed(this.digits)}ms`;
		return `${(time * 1_000).toFixed(this.digits)}μs`;
	}
}
