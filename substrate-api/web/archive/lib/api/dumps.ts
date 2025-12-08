import { apiClient, timeoutSignal } from './http';
import type { CreateDumpReq, CreateDumpRes } from '@/shared/contracts/dumps';

export async function createDump(req: CreateDumpReq): Promise<CreateDumpRes> {
  const res = (await apiClient({
    url: '/api/dumps/new',
    method: 'POST',
    body: req,
    signal: timeoutSignal(20000),
  })) as CreateDumpRes;

  if (!res.dump_id) {
    throw new Error('Missing dump_id in response');
  }
  return res;
}
