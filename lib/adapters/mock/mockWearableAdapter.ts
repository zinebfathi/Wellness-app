import type { IWearableAdapter } from "../types";
import { mockProfile } from "@/data/mockProfile";

export class MockWearableAdapter implements IWearableAdapter {
  async getLastPeriodDate(): Promise<string> {
    return mockProfile.date_of_last_cycle;
  }

  async getCycleLength(): Promise<number> {
    return mockProfile.cycle_length_days ?? 28;
  }
}
