import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { runSkillTest } from './helpers/session-runner';
import { startTestServer } from '../browse/test/test-server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Skip if SKILL_E2E not set, or if running inside a Claude Code / Agent SDK session
// (nested Agent SDK sessions hang because the parent intercepts child claude subprocesses)
const isInsideAgentSDK = !!process.env.CLAUDECODE || !!process.env.CLAUDE_CODE_ENTRYPOINT;
const describeE2E = (process.env.SKILL_E2E && !isInsideAgentSDK) ? describe : describe.skip;

let testServer: ReturnType<typeof startTestServer>;
let tmpDir: string;

describeE2E('Skill E2E tests', () => {
  beforeAll(() => {
    testServer = startTestServer();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-e2e-'));

    // Symlink browse binary into tmpdir for the skill to find
    const browseBin = path.resolve(import.meta.dir, '..', 'browse', 'dist', 'browse');
    const binDir = path.join(tmpDir, 'browse', 'dist');
    fs.mkdirSync(binDir, { recursive: true });
    if (fs.existsSync(browseBin)) {
      fs.symlinkSync(browseBin, path.join(binDir, 'browse'));
    }

    // Also create browse/bin/find-browse so the SKILL.md setup works
    const findBrowseDir = path.join(tmpDir, 'browse', 'bin');
    fs.mkdirSync(findBrowseDir, { recursive: true });
    fs.writeFileSync(path.join(findBrowseDir, 'find-browse'), `#!/bin/bash\necho "${browseBin}"\n`, { mode: 0o755 });
  });

  afterAll(() => {
    testServer?.server?.stop();
    // Clean up tmpdir
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('browse basic commands work without errors', async () => {
    const result = await runSkillTest({
      prompt: `You have a browse binary at ${path.resolve(import.meta.dir, '..', 'browse', 'dist', 'browse')}. Assign it to B variable and run these commands in sequence:
1. $B goto ${testServer.url}
2. $B snapshot -i
3. $B text
4. $B screenshot /tmp/skill-e2e-test.png
Report the results of each command.`,
      workingDirectory: tmpDir,
      maxTurns: 10,
      timeout: 60_000,
    });

    expect(result.browseErrors).toHaveLength(0);
    expect(result.exitReason).toBe('success');
  }, 90_000);

  test('browse snapshot flags all work', async () => {
    const result = await runSkillTest({
      prompt: `You have a browse binary at ${path.resolve(import.meta.dir, '..', 'browse', 'dist', 'browse')}. Assign it to B variable and run:
1. $B goto ${testServer.url}
2. $B snapshot -i
3. $B snapshot -c
4. $B snapshot -D
5. $B snapshot -i -a -o /tmp/skill-e2e-annotated.png
Report what each command returned.`,
      workingDirectory: tmpDir,
      maxTurns: 10,
      timeout: 60_000,
    });

    expect(result.browseErrors).toHaveLength(0);
    expect(result.exitReason).toBe('success');
  }, 90_000);

  test.todo('/qa quick completes without browse errors');
  test.todo('/ship completes without browse errors');
  test.todo('/review completes without browse errors');
});
