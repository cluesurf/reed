// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Base error class for all parse failures.
 *
 * Every parse error carries the input position (UTF-16
 * code-unit offset) so editor surfaces can highlight the
 * offending span.
 */

export class ReedParseError extends Error {
  readonly code: ParseErrorCode
  readonly offset: number

  constructor(input: { code: ParseErrorCode; message: string; offset: number }) {
    super(input.message)
    this.name = 'ReedParseError'
    this.code = input.code
    this.offset = input.offset
  }
}

export type ParseErrorCode =
  | 'empty-input'
  | 'unknown-glyph'
  | 'simplified-form-rejected'
  | 'phone-not-in-phonology'
