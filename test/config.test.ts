import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  helpText,
  normalizeBaseUrl,
  parseArgs,
  resolveConfig,
} from '../src/config.js';
import { ConfigError } from '../src/core/errors.js';
import { VERSION } from '../src/version.js';
import { TEST_KEY } from './helpers.js';

/** Resolve with an explicit environment, so a developer's own shell cannot leak in. */
function resolve(argv: string[], env: NodeJS.ProcessEnv = {}) {
  return resolveConfig(parseArgs(argv), env);
}

describe('argument parsing', () => {
  it('accepts both --flag value and --flag=value', () => {
    expect(parseArgs(['--api-key', TEST_KEY]).values['api-key']).toBe(TEST_KEY);
    expect(parseArgs([`--api-key=${TEST_KEY}`]).values['api-key']).toBe(TEST_KEY);
  });

  it('accepts the short forms of help and version', () => {
    expect(parseArgs(['-h']).flags.has('help')).toBe(true);
    expect(parseArgs(['-v']).flags.has('version')).toBe(true);
    expect(parseArgs(['--help']).flags.has('help')).toBe(true);
    expect(parseArgs(['--version']).flags.has('version')).toBe(true);
  });

  it('rejects an unknown flag instead of ignoring it', () => {
    // Silently ignoring a misspelled flag is how someone ends up believing they
    // are in read-only mode when they are not.
    expect(() => parseArgs(['--red-only'])).toThrow(ConfigError);
    expect(() => parseArgs(['--tools-list', 'social'])).toThrow(/Unknown flag/);
  });

  it('rejects a bare argument', () => {
    expect(() => parseArgs(['social'])).toThrow(/Unexpected argument/);
  });

  it('rejects a value flag with no value', () => {
    expect(() => parseArgs(['--tools'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--tools', '--read-only'])).toThrow(/needs a value/);
  });
});

describe('configuration resolution', () => {
  it('requires a key and says where to get one', () => {
    expect(() => resolve([])).toThrow(/No API key/);
    expect(() => resolve([])).toThrow(/app\.pinlyx\.com\/settings\/developers/);
  });

  it('rejects something that is not a Pinlyx key', () => {
    expect(() => resolve(['--api-key', 'sk-not-ours'])).toThrow(/must start with 'csk_'/);
  });

  it('reads the key from the environment as well as the flag', () => {
    expect(resolve([], { PINLYX_API_KEY: TEST_KEY }).apiKey).toBe(TEST_KEY);
  });

  it('falls back to the pre-1.0 CRMSOLID_ names when the PINLYX_ one is absent', () => {
    const config = resolve([], {
      CRMSOLID_API_KEY: TEST_KEY,
      CRMSOLID_BASE_URL: 'https://legacy.example.test',
      CRMSOLID_TOOLS: 'contacts',
      CRMSOLID_READ_ONLY: '1',
      CRMSOLID_TIMEOUT_MS: '7000',
      CRMSOLID_MAX_RETRIES: '1',
      CRMSOLID_SSE: '0',
      CRMSOLID_DEBUG: '1',
    });
    expect(config).toMatchObject({
      apiKey: TEST_KEY,
      baseUrl: 'https://legacy.example.test',
      toolGroups: ['contacts'],
      readOnly: true,
      timeoutMs: 7000,
      maxRetries: 1,
      sse: false,
      debug: true,
    });
  });

  it('prefers PINLYX_ over CRMSOLID_ when both are set', () => {
    const other = 'csk_live_otherotherotherotherotherotherother00';
    const config = resolve([], {
      PINLYX_API_KEY: TEST_KEY,
      CRMSOLID_API_KEY: other,
      PINLYX_BASE_URL: 'https://new.example.test',
      CRMSOLID_BASE_URL: 'https://old.example.test',
      PINLYX_READ_ONLY: '0',
      CRMSOLID_READ_ONLY: '1',
    });
    expect(config.apiKey).toBe(TEST_KEY);
    expect(config.baseUrl).toBe('https://new.example.test');
    expect(config.readOnly).toBe(false);
  });

  it('treats an empty PINLYX_ value as unset and uses the legacy one', () => {
    const config = resolve([], { PINLYX_API_KEY: '  ', CRMSOLID_API_KEY: TEST_KEY });
    expect(config.apiKey).toBe(TEST_KEY);
  });

  it('only shows PINLYX_ names in the help and in the missing-key error', () => {
    expect(helpText()).not.toMatch(/crmsolid/i);
    expect(() => resolve([])).toThrow(/PINLYX_API_KEY/);
    expect(() => resolve([])).not.toThrow(/CRMSOLID/);
  });

  it('lets a flag beat the environment', () => {
    const config = resolve(['--base-url', 'https://staging.example.test'], {
      PINLYX_API_KEY: TEST_KEY,
      PINLYX_BASE_URL: 'https://env.example.test',
    });
    expect(config.baseUrl).toBe('https://staging.example.test');
  });

  it('defaults everything the contract defaults', () => {
    const config = resolve([], { PINLYX_API_KEY: TEST_KEY });
    expect(config).toMatchObject({
      baseUrl: DEFAULT_BASE_URL,
      endpoint: `${DEFAULT_BASE_URL}/mcp`,
      toolGroups: null,
      readOnly: false,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxRetries: DEFAULT_MAX_RETRIES,
      sse: true,
      debug: false,
    });
  });

  it('reads the tool filter from either source', () => {
    expect(resolve(['--tools', 'social,posts'], { PINLYX_API_KEY: TEST_KEY }).toolGroups).toEqual([
      'social',
      'posts',
    ]);
    expect(resolve([], { PINLYX_API_KEY: TEST_KEY, PINLYX_TOOLS: 'contacts' }).toolGroups).toEqual([
      'contacts',
    ]);
  });

  it('rejects a misspelled group rather than silently exposing nothing', () => {
    expect(() => resolve(['--tools', 'social,psots'], { PINLYX_API_KEY: TEST_KEY })).toThrow(/psots/);
  });

  it('reads read-only from either source', () => {
    expect(resolve(['--read-only'], { PINLYX_API_KEY: TEST_KEY }).readOnly).toBe(true);
    expect(resolve([], { PINLYX_API_KEY: TEST_KEY, PINLYX_READ_ONLY: '1' }).readOnly).toBe(true);
    expect(resolve([], { PINLYX_API_KEY: TEST_KEY, PINLYX_READ_ONLY: 'true' }).readOnly).toBe(true);
    expect(resolve([], { PINLYX_API_KEY: TEST_KEY, PINLYX_READ_ONLY: 'no' }).readOnly).toBe(false);
    expect(resolve([], { PINLYX_API_KEY: TEST_KEY, PINLYX_READ_ONLY: '' }).readOnly).toBe(false);
  });

  it('turns the notification stream off from either source', () => {
    expect(resolve(['--no-sse'], { PINLYX_API_KEY: TEST_KEY }).sse).toBe(false);
    expect(resolve([], { PINLYX_API_KEY: TEST_KEY, PINLYX_SSE: '0' }).sse).toBe(false);
    expect(resolve([], { PINLYX_API_KEY: TEST_KEY, PINLYX_SSE: '1' }).sse).toBe(true);
  });

  it('validates the numeric flags', () => {
    expect(resolve(['--timeout', '5000'], { PINLYX_API_KEY: TEST_KEY }).timeoutMs).toBe(5_000);
    expect(resolve(['--max-retries', '0'], { PINLYX_API_KEY: TEST_KEY }).maxRetries).toBe(0);
    expect(() => resolve(['--timeout', '0'], { PINLYX_API_KEY: TEST_KEY })).toThrow(/positive/);
    expect(() => resolve(['--timeout', 'soon'], { PINLYX_API_KEY: TEST_KEY })).toThrow(/positive/);
    expect(() => resolve(['--max-retries', '-1'], { PINLYX_API_KEY: TEST_KEY })).toThrow(/zero or/);
  });
});

describe('base url normalization', () => {
  it('adds a scheme, drops a trailing slash, and drops a pasted /mcp', () => {
    expect(normalizeBaseUrl('api.pinlyx.com')).toBe('https://api.pinlyx.com');
    expect(normalizeBaseUrl('https://api.pinlyx.com/')).toBe('https://api.pinlyx.com');
    expect(normalizeBaseUrl('https://api.pinlyx.com/mcp')).toBe('https://api.pinlyx.com');
    expect(normalizeBaseUrl('https://api.pinlyx.com/mcp/')).toBe('https://api.pinlyx.com');
  });

  it('keeps a path prefix, for a self-hosted deployment behind a sub-path', () => {
    expect(normalizeBaseUrl('https://internal.example.test/crm/')).toBe('https://internal.example.test/crm');
    expect(normalizeBaseUrl('http://localhost:8081')).toBe('http://localhost:8081');
  });

  it('rejects something that is not a URL', () => {
    expect(() => normalizeBaseUrl('   ')).toThrow(ConfigError);
    expect(() => normalizeBaseUrl('https://')).toThrow(ConfigError);
  });
});

describe('help text', () => {
  it('documents every flag and both configuration sources', () => {
    const help = helpText();
    for (const flag of [
      '--api-key',
      '--base-url',
      '--tools',
      '--read-only',
      '--timeout',
      '--max-retries',
      '--no-sse',
      '--debug',
      '--help',
      '--version',
    ]) {
      expect(help).toContain(flag);
    }
    for (const env of [
      'PINLYX_API_KEY',
      'PINLYX_BASE_URL',
      'PINLYX_TOOLS',
      'PINLYX_READ_ONLY',
      'PINLYX_TIMEOUT_MS',
      'PINLYX_MAX_RETRIES',
      'PINLYX_SSE',
      'PINLYX_DEBUG',
    ]) {
      expect(help).toContain(env);
    }
  });

  it('names the clients this server is meant to be configured in', () => {
    const help = helpText();
    expect(help).toContain('Claude Desktop');
    expect(help).toContain('Claude Code');
    expect(help).toContain('Cursor');
    expect(help).toContain('ChatGPT');
    expect(help).toContain('pinlyx-mcp');
  });

  it('reports the package version', () => {
    expect(helpText()).toContain(`pinlyx-mcp ${VERSION}`);
  });
});
