import type { IProfileAdapter } from "../types";
import type { UserProfile } from "@/types";
import { mockProfile } from "@/data/mockProfile";

export class MockProfileAdapter implements IProfileAdapter {
  async getProfile(): Promise<UserProfile> {
    return mockProfile;
  }
}
