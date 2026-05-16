import { verifyChain } from "../../shared/audit";
import * as repo from "./audit.repo";

export async function list(filter: repo.ListFilter) {
  return repo.listEntries(filter);
}

export async function verify() {
  return verifyChain();
}
