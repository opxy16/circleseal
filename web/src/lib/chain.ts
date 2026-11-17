import { createPublicClient, http, type AbiEvent, type Address, type Log } from "viem";
import { chain, deployBlock } from "./config";

export const publicClient = createPublicClient({ chain, transport: http() });

/** QIE nodes cap eth_getLogs ranges, so read events in chunks. */
const CHUNK = 2_000n;

export async function getLogsChunked<E extends AbiEvent>(params: {
  address: Address;
  event: E;
  args?: Record<string, unknown>;
}): Promise<Log[]> {
  const latest = await publicClient.getBlockNumber();
  const logs: Log[] = [];
  for (let from = deployBlock; from <= latest; from += CHUNK) {
    const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
    const part = await publicClient.getLogs({
      address: params.address,
      event: params.event,
      args: params.args as never,
      fromBlock: from,
      toBlock: to,
    });
    logs.push(...part);
  }
  return logs;
}
