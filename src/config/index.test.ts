import { config } from './index';

describe('Configuration', () => {
  it('should load default configuration values', () => {
    expect(config.server.port).toBeDefined();
    expect(config.sync.defaultInterval).toBeDefined();
  });

  it('should have required configuration structure', () => {
    expect(config).toHaveProperty('streetPricer');
    expect(config).toHaveProperty('encryption');
    expect(config).toHaveProperty('database');
    expect(config).toHaveProperty('server');
    expect(config).toHaveProperty('sync');
  });
});
