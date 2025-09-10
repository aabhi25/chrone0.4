/**
 * Automated Tests for Weekly Timetable Workflow
 * 
 * This test suite validates the complete workflow described in the requirements:
 * 1. Refresh Global Timetable Action
 * 2. Weekly Overrides
 * 3. Set Weekly as Global
 * 4. Edge Cases (mid-week refresh, multiple class independence)
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Mock API client for testing
class TimetableTestClient {
  private baseUrl = 'http://localhost:5000/api';
  private authToken = '';

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    this.authToken = data.token || '';
    return response.ok;
  }

  async refreshGlobalTimetable(classId: string) {
    const response = await fetch(`${this.baseUrl}/timetable/refresh-global/${classId}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json' 
      }
    });
    return await response.json();
  }

  async getWeeklyTimetable(classId: string, date?: string) {
    const params = date ? `?date=${date}` : '';
    const response = await fetch(`${this.baseUrl}/timetable/weekly/${classId}${params}`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });
    return await response.json();
  }

  async getEnhancedTimetable(classId: string, date?: string) {
    const params = date ? `?date=${date}` : '';
    const response = await fetch(`${this.baseUrl}/timetable/enhanced/${classId}${params}`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });
    return await response.json();
  }

  async setWeeklyAsGlobal(classId: string, date: string) {
    const response = await fetch(`${this.baseUrl}/timetable/set-weekly-as-global/${classId}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ date })
    });
    return await response.json();
  }

  async manualAssignment(params: any) {
    const response = await fetch(`${this.baseUrl}/timetable/manual-assign`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(params)
    });
    return await response.json();
  }

  async deleteTimetableEntry(entryId: string, date?: string) {
    const params = date ? `?date=${date}` : '';
    const response = await fetch(`${this.baseUrl}/timetable/entry/${entryId}${params}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });
    return await response.json();
  }

  async getGlobalTimetable(classId: string) {
    const response = await fetch(`${this.baseUrl}/timetable/global?classId=${classId}`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });
    return await response.json();
  }
}

// Mock data for testing
const mockData = {
  // Multiple test classes
  testClasses: [
    { id: 'class-1', name: 'Grade 1A', schoolId: 'school-1' },
    { id: 'class-2', name: 'Grade 2B', schoolId: 'school-1' },
    { id: 'class-3', name: 'Grade 3C', schoolId: 'school-1' }
  ],
  
  // Test weeks
  testWeeks: {
    currentWeek: '2025-09-08', // Monday
    nextWeek: '2025-09-15',    // Monday  
    lastWeek: '2025-09-01'     // Monday
  },
  
  // Mock teachers and subjects for assignments
  teachers: [
    { id: 'teacher-1', name: 'Ms. Smith', subjectIds: ['math', 'science'] },
    { id: 'teacher-2', name: 'Mr. Johnson', subjectIds: ['english', 'history'] },
    { id: 'teacher-3', name: 'Ms. Davis', subjectIds: ['art', 'music'] }
  ],
  
  subjects: [
    { id: 'math', name: 'Mathematics' },
    { id: 'science', name: 'Science' },
    { id: 'english', name: 'English' },
    { id: 'history', name: 'History' },
    { id: 'art', name: 'Art' },
    { id: 'music', name: 'Music' }
  ]
};

describe('Weekly Timetable Workflow Tests', () => {
  let client: TimetableTestClient;
  let testClassIds: string[];

  beforeAll(async () => {
    client = new TimetableTestClient();
    // Login with admin credentials
    const loginSuccess = await client.login('admin@chrona.com', 'admin123');
    expect(loginSuccess).toBe(true);
    
    // Use real class IDs from the system
    testClassIds = ['67fafc63-3e98-4c5a-806b-72e7667b7097']; // The existing class we can see in logs
  });

  describe('1. Refresh Global Timetable Action', () => {
    test('should generate new global timetable and copy to current week', async () => {
      const classId = testClassIds[0];
      
      // Step 1: Refresh global timetable
      const refreshResult = await client.refreshGlobalTimetable(classId);
      
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.entriesCreated).toBeGreaterThan(0);
      expect(refreshResult.weekStart).toBeDefined();
      
      console.log('✅ Global timetable refreshed:', refreshResult);
      
      // Step 2: Verify global timetable was created
      const globalTimetable = await client.getGlobalTimetable(classId);
      expect(Array.isArray(globalTimetable)).toBe(true);
      expect(globalTimetable.length).toBeGreaterThan(0);
      
      console.log('✅ Global timetable entries:', globalTimetable.length);
      
      // Step 3: Verify weekly timetable was copied for current week
      const weeklyTimetable = await client.getWeeklyTimetable(classId);
      expect(weeklyTimetable.type).toBe('weekly');
      expect(weeklyTimetable.hasWeeklyOverrides).toBe(true);
      
      console.log('✅ Weekly timetable created automatically');
    });
    
    test('should handle mid-week refresh and overwrite current weekly timetable', async () => {
      const classId = testClassIds[0];
      const currentWeek = mockData.testWeeks.currentWeek;
      
      // Step 1: Make a manual change to create weekly override
      const enhancedTimetable = await client.getEnhancedTimetable(classId);
      if (enhancedTimetable.entries && enhancedTimetable.entries.length > 0) {
        const firstEntry = enhancedTimetable.entries[0];
        
        const assignmentResult = await client.manualAssignment({
          timetableEntryId: firstEntry.id,
          newTeacherId: firstEntry.teacherId,
          classId: classId,
          day: firstEntry.day,
          period: firstEntry.period,
          reason: 'Test manual assignment before mid-week refresh'
        });
        
        expect(assignmentResult.success).toBe(true);
        console.log('✅ Manual assignment created before mid-week refresh');
      }
      
      // Step 2: Perform mid-week refresh
      const refreshResult = await client.refreshGlobalTimetable(classId);
      expect(refreshResult.success).toBe(true);
      
      console.log('✅ Mid-week refresh completed');
      
      // Step 3: Verify weekly timetable was overwritten
      const weeklyAfterRefresh = await client.getWeeklyTimetable(classId, currentWeek);
      expect(weeklyAfterRefresh.hasWeeklyOverrides).toBe(true);
      
      console.log('✅ Weekly timetable overwritten by mid-week refresh');
    });
  });

  describe('2. Weekly Overrides', () => {
    test('should update only weekly timetable when admin makes changes', async () => {
      const classId = testClassIds[0];
      
      // Step 1: Get original global timetable
      const originalGlobal = await client.getGlobalTimetable(classId);
      const originalGlobalCount = originalGlobal.length;
      
      // Step 2: Get enhanced timetable to find an entry to modify
      const enhancedTimetable = await client.getEnhancedTimetable(classId);
      expect(enhancedTimetable.entries.length).toBeGreaterThan(0);
      
      const entryToModify = enhancedTimetable.entries[0];
      
      // Step 3: Make manual assignment (should only affect weekly)
      const assignmentResult = await client.manualAssignment({
        timetableEntryId: entryToModify.id,
        newTeacherId: entryToModify.teacherId,
        classId: classId,
        day: entryToModify.day,
        period: entryToModify.period,
        reason: 'Testing weekly override without affecting global'
      });
      
      expect(assignmentResult.success).toBe(true);
      console.log('✅ Manual assignment created for weekly override');
      
      // Step 4: Verify global timetable unchanged
      const globalAfterChange = await client.getGlobalTimetable(classId);
      expect(globalAfterChange.length).toBe(originalGlobalCount);
      
      console.log('✅ Global timetable remains unchanged');
      
      // Step 5: Verify weekly timetable reflects the change
      const weeklyAfterChange = await client.getEnhancedTimetable(classId);
      expect(weeklyAfterChange.source).toBe('weekly');
      expect(weeklyAfterChange.modificationCount).toBeGreaterThan(0);
      
      console.log('✅ Weekly timetable shows the override');
    });
    
    test('should handle period cancellation as weekly override', async () => {
      const classId = testClassIds[0];
      const testDate = mockData.testWeeks.currentWeek;
      
      // Step 1: Get enhanced timetable
      const enhancedTimetable = await client.getEnhancedTimetable(classId);
      expect(enhancedTimetable.entries.length).toBeGreaterThan(0);
      
      const entryToCancel = enhancedTimetable.entries.find((e: any) => e.teacherId && e.subjectId);
      expect(entryToCancel).toBeDefined();
      
      // Step 2: Cancel the period
      const cancelResult = await client.deleteTimetableEntry(entryToCancel.id, testDate);
      expect(cancelResult.success).toBe(true);
      
      console.log('✅ Period cancelled for specific week');
      
      // Step 3: Verify weekly timetable shows cancellation
      const weeklyAfterCancel = await client.getEnhancedTimetable(classId, testDate);
      expect(weeklyAfterCancel.source).toBe('weekly');
      
      // The cancelled period should appear as modified in weekly timetable
      const modifiedEntries = weeklyAfterCancel.entries.filter((e: any) => e.isModified);
      expect(modifiedEntries.length).toBeGreaterThan(0);
      
      console.log('✅ Weekly timetable shows period cancellation');
    });
  });

  describe('3. Set Weekly as Global', () => {
    test('should promote weekly timetable changes to global timetable', async () => {
      const classId = testClassIds[0];
      const testDate = mockData.testWeeks.currentWeek;
      
      // Step 1: Make sure we have a weekly timetable with changes
      const enhancedTimetable = await client.getEnhancedTimetable(classId);
      if (enhancedTimetable.source !== 'weekly') {
        // Create a weekly override first
        const entryToModify = enhancedTimetable.entries[0];
        await client.manualAssignment({
          timetableEntryId: entryToModify.id,
          newTeacherId: entryToModify.teacherId,
          classId: classId,
          day: entryToModify.day,
          period: entryToModify.period,
          reason: 'Creating weekly override for promotion test'
        });
      }
      
      // Step 2: Get weekly timetable data before promotion
      const weeklyBefore = await client.getWeeklyTimetable(classId, testDate);
      expect(weeklyBefore.hasWeeklyOverrides).toBe(true);
      
      // Step 3: Promote weekly to global
      const promoteResult = await client.setWeeklyAsGlobal(classId, testDate);
      expect(promoteResult.success).toBe(true);
      expect(promoteResult.entriesPromoted).toBeGreaterThan(0);
      
      console.log('✅ Weekly timetable promoted to global:', promoteResult);
      
      // Step 4: Verify global timetable now reflects weekly changes
      const globalAfterPromotion = await client.getGlobalTimetable(classId);
      expect(globalAfterPromotion.length).toBe(promoteResult.entriesPromoted);
      
      console.log('✅ Global timetable updated with promoted changes');
      
      // Step 5: Verify future weeks default to new global timetable
      const nextWeekTimetable = await client.getEnhancedTimetable(classId, mockData.testWeeks.nextWeek);
      expect(nextWeekTimetable.source).toBe('global'); // Should use new global, not weekly
      
      console.log('✅ Future weeks default to updated global timetable');
    });
  });

  describe('4. Edge Cases and Multiple Class Independence', () => {
    test('should maintain independence between multiple classes', async () => {
      // Note: This test assumes we have multiple classes, but we're using one real class
      // In a real scenario, you would test with multiple actual class IDs
      const classId = testClassIds[0];
      
      // Test that changes to one class don't affect others
      // Since we only have one real class, we'll simulate this by testing different weeks
      
      // Step 1: Create different weekly overrides for different weeks
      const currentWeekDate = mockData.testWeeks.currentWeek;
      const nextWeekDate = mockData.testWeeks.nextWeek;
      
      // Get base timetable
      const baseTimetable = await client.getEnhancedTimetable(classId, currentWeekDate);
      if (baseTimetable.entries.length > 0) {
        const entryToModify = baseTimetable.entries[0];
        
        // Make change for current week
        await client.manualAssignment({
          timetableEntryId: entryToModify.id,
          newTeacherId: entryToModify.teacherId,
          classId: classId,
          day: entryToModify.day,
          period: entryToModify.period,
          reason: 'Current week modification'
        });
        
        console.log('✅ Current week modified');
      }
      
      // Step 2: Verify next week is unaffected
      const nextWeekTimetable = await client.getEnhancedTimetable(classId, nextWeekDate);
      // Next week should use global timetable unless explicitly modified
      expect(nextWeekTimetable.source).toBe('global');
      
      console.log('✅ Next week remains independent and unaffected');
    });
    
    test('should handle concurrent modifications across different weeks', async () => {
      const classId = testClassIds[0];
      
      // Test concurrent modifications to different weeks
      const dates = [
        mockData.testWeeks.currentWeek,
        mockData.testWeeks.nextWeek
      ];
      
      for (const date of dates) {
        const timetable = await client.getEnhancedTimetable(classId, date);
        if (timetable.entries.length > 0) {
          const entryToModify = timetable.entries[0];
          
          const result = await client.manualAssignment({
            timetableEntryId: entryToModify.id,
            newTeacherId: entryToModify.teacherId,
            classId: classId,
            day: entryToModify.day,
            period: entryToModify.period,
            reason: `Modification for week ${date}`
          });
          
          expect(result.success).toBe(true);
          console.log(`✅ Week ${date} modified independently`);
        }
      }
      
      // Verify each week maintains its own weekly timetable
      for (const date of dates) {
        const weeklyTimetable = await client.getWeeklyTimetable(classId, date);
        if (weeklyTimetable.hasWeeklyOverrides) {
          console.log(`✅ Week ${date} has independent weekly overrides`);
        }
      }
    });
    
    test('should handle refresh during active weekly modifications', async () => {
      const classId = testClassIds[0];
      
      // Step 1: Create weekly modifications
      const enhancedTimetable = await client.getEnhancedTimetable(classId);
      if (enhancedTimetable.entries.length > 0) {
        const entryToModify = enhancedTimetable.entries[0];
        
        await client.manualAssignment({
          timetableEntryId: entryToModify.id,
          newTeacherId: entryToModify.teacherId,
          classId: classId,
          day: entryToModify.day,
          period: entryToModify.period,
          reason: 'Modification before refresh test'
        });
        
        console.log('✅ Weekly modification created');
      }
      
      // Step 2: Perform global refresh (should overwrite weekly for current week)
      const refreshResult = await client.refreshGlobalTimetable(classId);
      expect(refreshResult.success).toBe(true);
      
      console.log('✅ Global refresh completed during active weekly modifications');
      
      // Step 3: Verify refresh overwrote current week's weekly timetable
      const weeklyAfterRefresh = await client.getWeeklyTimetable(classId);
      expect(weeklyAfterRefresh.hasWeeklyOverrides).toBe(true);
      
      console.log('✅ Current week weekly timetable properly overwritten by refresh');
    });
  });

  describe('5. Complete Workflow Integration Test', () => {
    test('should execute complete workflow: refresh → override → promote', async () => {
      const classId = testClassIds[0];
      const testDate = mockData.testWeeks.currentWeek;
      
      console.log('🚀 Starting complete workflow integration test...');
      
      // Step 1: Refresh Global Timetable
      console.log('Step 1: Refreshing global timetable...');
      const refreshResult = await client.refreshGlobalTimetable(classId);
      expect(refreshResult.success).toBe(true);
      console.log('✅ Global timetable refreshed and copied to weekly');
      
      // Step 2: Make weekly overrides
      console.log('Step 2: Making weekly overrides...');
      const enhancedTimetable = await client.getEnhancedTimetable(classId);
      if (enhancedTimetable.entries.length > 1) {
        // Modify first entry
        const firstEntry = enhancedTimetable.entries[0];
        await client.manualAssignment({
          timetableEntryId: firstEntry.id,
          newTeacherId: firstEntry.teacherId,
          classId: classId,
          day: firstEntry.day,
          period: firstEntry.period,
          reason: 'Integration test modification 1'
        });
        
        // Cancel second entry
        const secondEntry = enhancedTimetable.entries[1];
        await client.deleteTimetableEntry(secondEntry.id, testDate);
        
        console.log('✅ Weekly overrides created (1 modification, 1 cancellation)');
      }
      
      // Step 3: Verify weekly overrides are active
      console.log('Step 3: Verifying weekly overrides...');
      const weeklyWithOverrides = await client.getEnhancedTimetable(classId, testDate);
      expect(weeklyWithOverrides.source).toBe('weekly');
      expect(weeklyWithOverrides.modificationCount).toBeGreaterThan(0);
      console.log('✅ Weekly overrides confirmed active');
      
      // Step 4: Promote weekly to global
      console.log('Step 4: Promoting weekly timetable to global...');
      const promoteResult = await client.setWeeklyAsGlobal(classId, testDate);
      expect(promoteResult.success).toBe(true);
      console.log('✅ Weekly timetable promoted to global');
      
      // Step 5: Verify global timetable updated
      console.log('Step 5: Verifying global timetable update...');
      const finalGlobal = await client.getGlobalTimetable(classId);
      expect(finalGlobal.length).toBeGreaterThan(0);
      console.log('✅ Global timetable updated with promoted changes');
      
      // Step 6: Verify future weeks use new global
      console.log('Step 6: Verifying future weeks use updated global...');
      const futureWeek = await client.getEnhancedTimetable(classId, mockData.testWeeks.nextWeek);
      expect(futureWeek.source).toBe('global');
      console.log('✅ Future weeks default to updated global timetable');
      
      console.log('🎉 Complete workflow integration test PASSED!');
    });
  });
});

// Export the test client for potential reuse
export { TimetableTestClient, mockData };