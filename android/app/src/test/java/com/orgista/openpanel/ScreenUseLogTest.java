package com.orgista.openpanel;

import static org.junit.Assert.assertEquals;

import java.util.Arrays;
import java.util.Collections;

import org.junit.Test;

public class ScreenUseLogTest {
    @Test
    public void countsOnlyScreenOnUnlockedTime() {
        assertEquals(30 + 5 + 20, ScreenUseLog.inUseMs(Arrays.asList(
                new long[] {130, ScreenUseLog.SCREEN_OFF},
                new long[] {200, ScreenUseLog.SCREEN_ON},
                new long[] {205, ScreenUseLog.LOCKED},
                new long[] {210, ScreenUseLog.UNLOCKED},
                new long[] {230, ScreenUseLog.SCREEN_OFF},
                new long[] {240, 1}), 100, 300, true));
    }

    @Test
    public void screenOffAtTheStartCountsNothingUntilItComesOn() {
        assertEquals(50, ScreenUseLog.inUseMs(Collections.singletonList(new long[] {250, ScreenUseLog.SCREEN_ON}), 100, 300, false));
        assertEquals(0, ScreenUseLog.inUseMs(Collections.emptyList(), 100, 300, false));
    }
}
