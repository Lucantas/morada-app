import { closeTestDbs } from '../platform/db';

afterEach(() => {
  closeTestDbs();
});
