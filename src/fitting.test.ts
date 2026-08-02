import { describe, expect, it } from 'vitest';

import { counterDepth, fitting, pieceWidth, sushiCap } from './fitting';

/**
 * Four screens, which are the four the game is played on.
 *
 * The iPad on its side is the one every size in the app was chosen against, so
 * it is here to prove nothing moved. The other three are the ones that could
 * not be played at all: the same iPad stood up, and a phone either way round.
 * Sizes are the usable screen, with the notch and the home bar already taken
 * off.
 */
const PAD = { width: 1180, height: 796 };
const PAD_UP = { width: 820, height: 1156 };
const PHONE_UP = { width: 393, height: 759 };
const PHONE_OVER = { width: 734, height: 372 };

describe('fitting the game to the screen', () => {
  it('changes nothing on the iPad it was drawn for', () => {
    const fit = fitting(PAD);
    expect(fit.dragon).toBe(320);
    expect(fit.door).toBe(300);
    expect(fit.intro).toBe(220);
    expect(fit.snug).toBe(false);
  });

  it('changes nothing when that iPad is stood up either', () => {
    const fit = fitting(PAD_UP);
    expect(fit.dragon).toBe(320);
    expect(fit.door).toBe(300);
    expect(fit.portrait).toBe(true);
  });

  it('draws a dragon a phone has room for, upright', () => {
    const fit = fitting(PHONE_UP);
    // it is the width that runs out on a phone held this way, not the height
    expect(fit.dragon).toBeLessThan(PHONE_UP.width);
    expect(fit.dragon).toBeGreaterThan(150);
  });

  it('gives up half the dragon rather than the counter on a phone lying down', () => {
    const fit = fitting(PHONE_OVER);
    expect(fit.snug).toBe(true);
    /* The whole of the game — dragon, the line telling him what to do, the
       shelf it is carried from — has to be inside 372 points. A dragon of 320
       is the bug: the sushi ends up below the bottom edge. */
    expect(fit.dragon).toBeLessThanOrEqual(PHONE_OVER.height / 2);
  });
});

describe('how wide a word is, served', () => {
  it('grows with the letters, not with the pieces it was cut into', () => {
    expect(pieceWidth(['drag', 'on'])).toBe(pieceWidth(['dr', 'ag', 'on']) - 16);
    expect(pieceWidth(['have'])).toBeLessThan(pieceWidth(['dragon']));
  });

  /* The seams cost a dot each and not a piece of sushi each, which is the
     whole of the change: `chocolate` is one piece of food a phone has room
     for at full size, where three pieces of it were not. */
  it('costs a seam far less than it used to cost a piece', () => {
    const cut = pieceWidth(['choc', 'o', 'late']);
    expect(cut).toBeLessThan(pieceWidth(['chocolate']) * 1.25);
    expect(sushiCap(PHONE_UP.width, cut)).toBe(1);
  });
});

describe('the size of a piece of sushi', () => {
  it('lets the round decide, on a screen with room to spare', () => {
    expect(sushiCap(PAD.width, pieceWidth(['drag', 'on']))).toBe(1);
    expect(sushiCap(PHONE_UP.width, pieceWidth(['on']))).toBe(1);
  });

  it('shrinks a long word until it fits across a phone', () => {
    const word = ['hip', 'po', 'pot', 'a', 'mus'];
    const cap = sushiCap(PHONE_UP.width, pieceWidth(word));

    expect(cap).toBeLessThan(1);
    expect(pieceWidth(word) * cap).toBeLessThanOrEqual(PHONE_UP.width);
  });

  it('never shrinks a word past reading it', () => {
    expect(sushiCap(200, pieceWidth(['extraordinary']))).toBe(0.4);
  });
});

describe('how deep to keep the counter', () => {
  it('is one piece deep when everything fits in a row', () => {
    const counter = [pieceWidth(['have']), pieceWidth(['has']), pieceWidth(['had'])];
    expect(counterDepth(PAD.width, counter, 0.8)).toBeCloseTo(118 * 0.8, 5);
  });

  it('is deeper when the pieces have to wrap', () => {
    const counter = [pieceWidth(['dragon']), pieceWidth(['dinner']), pieceWidth(['danger'])];
    expect(counterDepth(PHONE_UP.width, counter, 1)).toBeGreaterThan(
      counterDepth(PAD.width, counter, 1),
    );
  });

  it('holds the shelf up when there is nothing left on it', () => {
    // the dragon must not move when the last piece is eaten
    expect(counterDepth(PAD.width, [], 0.8)).toBeGreaterThan(0);
  });
});
