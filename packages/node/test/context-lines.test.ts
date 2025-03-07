import { StackFrame } from '@sentry/types';
import * as fs from 'fs';

import { parseStackFrames } from '../src/eventbuilder';
import { ContextLines, resetFileContentCache } from '../src/integrations/contextlines';
import { getError } from './helper/error';

describe('ContextLines', () => {
  let readFileSpy: jest.SpyInstance;
  let contextLines: ContextLines;

  async function addContext(frames: StackFrame[], lines: number = 7): Promise<void> {
    await contextLines.addSourceContext({ exception: { values: [{ stacktrace: { frames } }] } }, lines);
  }

  beforeEach(() => {
    readFileSpy = jest.spyOn(fs, 'readFile');
    contextLines = new ContextLines();
    resetFileContentCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('lru file cache', () => {
    test('parseStack with same file', async () => {
      expect.assertions(1);

      const frames = parseStackFrames(new Error('test'));

      await addContext(Array.from(frames));

      const numCalls = readFileSpy.mock.calls.length;
      await addContext(frames);

      // Calls to `readFile` shouldn't increase if there isn't a new error to
      // parse whose stacktrace contains a file we haven't yet seen
      expect(readFileSpy).toHaveBeenCalledTimes(numCalls);
    });

    test('parseStack with ESM module names', async () => {
      expect.assertions(1);

      const framesWithFilePath: StackFrame[] = [
        {
          colno: 1,
          filename: 'file:///var/task/index.js',
          lineno: 1,
          function: 'fxn1',
        },
      ];

      await addContext(framesWithFilePath);
      expect(readFileSpy).toHaveBeenCalledTimes(1);
    });

    test('parseStack with adding different file', async () => {
      expect.assertions(1);
      const frames = parseStackFrames(new Error('test'));

      await addContext(frames);

      const numCalls = readFileSpy.mock.calls.length;
      const parsedFrames = parseStackFrames(getError());
      await addContext(parsedFrames);

      const newErrorCalls = readFileSpy.mock.calls.length;
      expect(newErrorCalls).toBeGreaterThan(numCalls);
    });

    test('parseStack with duplicate files', async () => {
      expect.assertions(1);
      const framesWithDuplicateFiles: StackFrame[] = [
        {
          colno: 1,
          filename: '/var/task/index.js',
          lineno: 1,
          function: 'fxn1',
        },
        {
          colno: 2,
          filename: '/var/task/index.js',
          lineno: 2,
          function: 'fxn2',
        },
        {
          colno: 3,
          filename: '/var/task/index.js',
          lineno: 3,
          function: 'fxn3',
        },
      ];

      await addContext(framesWithDuplicateFiles);
      expect(readFileSpy).toHaveBeenCalledTimes(1);
    });

    test('parseStack with no context', async () => {
      expect.assertions(1);
      const frames = parseStackFrames(new Error('test'));

      await addContext(frames, 0);
      expect(readFileSpy).toHaveBeenCalledTimes(0);
    });
  });
});
