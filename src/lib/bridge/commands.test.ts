import { describe, expect, it } from 'vitest';
import { isAndroidCommand, isHandsFreeCommand } from './commands';

describe('isAndroidCommand', () => {
  it('takes the command and /phone, in any case and padding', () => {
    for (const typed of ['/android', '/phone', '  /Android ']) expect(isAndroidCommand(typed)).toBe(true);
  });

  it('leaves an instruction that merely mentions it alone', () => {
    expect(isAndroidCommand('/android open youtube')).toBe(false);
    expect(isAndroidCommand('android')).toBe(false);
  });
});

describe('isHandsFreeCommand', () => {
  it('takes the command and the spellings people reach for', () => {
    for (const typed of ['/hands-free', '/hand-free', '/handsfree', '  /Hands-Free ']) {
      expect(isHandsFreeCommand(typed)).toBe(true);
    }
  });

  it('leaves an instruction that merely mentions it alone', () => {
    expect(isHandsFreeCommand('/hands-free please')).toBe(false);
    expect(isHandsFreeCommand('hands-free')).toBe(false);
  });
});
