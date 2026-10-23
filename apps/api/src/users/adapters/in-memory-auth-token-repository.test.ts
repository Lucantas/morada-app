import { inMemoryAuthTokens } from '../../test-support/in-memory-users';

import { runAuthTokenRepositoryContract } from './auth-token-repository.contract';

runAuthTokenRepositoryContract('inMemoryAuthTokens', async () => inMemoryAuthTokens());
