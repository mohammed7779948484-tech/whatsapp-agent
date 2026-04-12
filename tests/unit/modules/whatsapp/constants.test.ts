import { describe, expect, it } from 'vitest';

import { WAHA_STATUS_MAP } from '../../../../src/modules/whatsapp/constants';

describe('WAHA_STATUS_MAP', () => {
  it('maps WORKING to connected', () => {
    expect(WAHA_STATUS_MAP.WORKING).toBe('connected');
  });

  it('maps SCAN_QR_CODE to qr_pending', () => {
    expect(WAHA_STATUS_MAP.SCAN_QR_CODE).toBe('qr_pending');
  });

  it('maps FAILED to error', () => {
    expect(WAHA_STATUS_MAP.FAILED).toBe('error');
  });

  it('maps STARTING to disconnected', () => {
    expect(WAHA_STATUS_MAP.STARTING).toBe('disconnected');
  });

  it('maps STOPPED to disconnected', () => {
    expect(WAHA_STATUS_MAP.STOPPED).toBe('disconnected');
  });
});
