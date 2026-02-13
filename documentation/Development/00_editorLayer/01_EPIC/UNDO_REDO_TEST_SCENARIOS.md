# Undo/Redo Behavior Test Scenarios

**Purpose:** Manual test scenarios to verify browser native undo/redo behavior and identify potential issues with programmatic text changes.

**Date:** February 10, 2026  
**Related:** Editor Performance Baseline Report

---

## Test Environment Setup

1. Open the baseline test page in the befly app:
   ```bash
   npm run dev
   # Navigate to /baseline-test
   ```

2. Or test the actual Write editor:
   ```bash
   npm run dev
   # Navigate to /write
   ```

---

## Test Scenario 1: Normal Typing Undo/Redo

**Purpose:** Verify browser native undo/redo works correctly for normal user typing.

### Steps:
1. Load a small test document or start with empty editor
2. Type the following text naturally:
   ```
   This is a test document.
   It has multiple lines.
   We will test undo and redo.
   ```
3. Press Ctrl+Z (Cmd+Z on Mac) three times
4. Press Ctrl+Shift+Z (Cmd+Shift+Z) twice to redo

### Expected Results:
- ✅ First Ctrl+Z should undo the last line: "We will test undo and redo."
- ✅ Second Ctrl+Z should undo: "It has multiple lines."
- ✅ Third Ctrl+Z should undo: "This is a test document."
- ✅ First redo should restore: "This is a test document."
- ✅ Second redo should restore: "It has multiple lines."

### Actual Results:
```
Test Date: _____________
Browser: _______________
Pass/Fail: _____________
Notes:
```

---

## Test Scenario 2: Programmatic Replace (Undo Stack Impact)

**Purpose:** Identify how programmatic text replacement affects undo stack.

### Steps:
1. Type the following text:
   ```
   the quick brown fox jumps over the lazy dog
   the cat sat on the mat
   ```
2. Click "Apply Programmatic Change" button (or run this code in console):
   ```javascript
   const editor = document.getElementById('body') || document.getElementById('editor');
   editor.value = editor.value.replace(/the/gi, 'THE');
   ```
3. Observe the text change (all "the" → "THE")
4. Press Ctrl+Z once

### Expected Results:
- ⚠️ Undo behavior is **browser-dependent** and may:
  - Option A: Undo entire programmatic change in one step
  - Option B: Undo partially or inconsistently
  - Option C: Clear undo history entirely

### Actual Results:
```
Test Date: _____________
Browser: _______________
What happened on Ctrl+Z:
[ ] Undid entire programmatic change
[ ] Undid user typing (lost undo history)
[ ] Nothing happened (undo broken)
[ ] Other: _____________________________

Notes:
```

**⚠️ CRITICAL FINDING:** Document the behavior for your browser as this affects auto-correction implementation decisions.

---

## Test Scenario 3: Programmatic Insert at Cursor

**Purpose:** Test undo behavior when text is inserted programmatically at cursor position.

### Steps:
1. Type: `Hello World`
2. Move cursor between "Hello" and "World" (after the space)
3. Click "Insert Text Programmatically" button (or run this code):
   ```javascript
   const editor = document.getElementById('body') || document.getElementById('editor');
   const pos = editor.selectionStart;
   const text = editor.value;
   editor.value = text.substring(0, pos) + '[INSERTED] ' + text.substring(pos);
   editor.selectionStart = editor.selectionEnd = pos + '[INSERTED] '.length;
   ```
4. Result should be: `Hello [INSERTED] World`
5. Press Ctrl+Z once

### Expected Results:
- ⚠️ Undo behavior may be unpredictable

### Actual Results:
```
Test Date: _____________
Browser: _______________
What happened on Ctrl+Z:
[ ] Undid the insertion
[ ] Undid user typing
[ ] Nothing
[ ] Other: _____________________________

Cursor position after undo: _____________

Notes:
```

---

## Test Scenario 4: Multiple Programmatic Changes

**Purpose:** Test undo stack when multiple programmatic changes are made in succession.

### Steps:
1. Type: `one two three four five`
2. Apply first programmatic change:
   ```javascript
   editor.value = editor.value.replace(/one/g, 'ONE');
   ```
3. Apply second programmatic change:
   ```javascript
   editor.value = editor.value.replace(/two/g, 'TWO');
   ```
4. Apply third programmatic change:
   ```javascript
   editor.value = editor.value.replace(/three/g, 'THREE');
   ```
5. Press Ctrl+Z multiple times

### Expected Results:
- ⚠️ Behavior is highly unpredictable

### Actual Results:
```
Test Date: _____________
Browser: _______________

After 1st Ctrl+Z: _________________________
After 2nd Ctrl+Z: _________________________
After 3rd Ctrl+Z: _________________________
After 4th Ctrl+Z: _________________________

Can you undo back to original text? [ ] Yes [ ] No

Notes:
```

---

## Test Scenario 5: Large Document Undo Performance

**Purpose:** Test if undo/redo performance degrades with document size.

### Steps:
1. Load "Large (100KB)" test document
2. Scroll to middle of document
3. Type several lines of text
4. Press Ctrl+Z to undo

### Expected Results:
- ✅ Undo should work quickly even with large document
- ⚠️ Some lag may be noticeable but should be < 1 second

### Actual Results:
```
Test Date: _____________
Browser: _______________
Document Size: _____________

Time to undo: _________ ms
Noticeable lag? [ ] Yes [ ] No

Notes:
```

---

## Test Scenario 6: Cross-Browser Comparison

**Purpose:** Compare undo/redo behavior across different browsers.

### Browsers to Test:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile Safari (iOS)
- [ ] Chrome Android

### Test Procedure:
Run Test Scenario 2 (Programmatic Replace) in each browser and document differences.

### Results Table:

| Browser | Undo Behavior | Redo Behavior | Notes |
|---------|---------------|---------------|-------|
| Chrome | | | |
| Firefox | | | |
| Safari | | | |
| Edge | | | |
| Mobile Safari | | | |
| Chrome Android | | | |

---

## Test Scenario 7: IME Input (International)

**Purpose:** Test undo/redo with Input Method Editor (IME) for non-Latin scripts.

### Steps:
1. Enable IME for Japanese, Chinese, or Korean input
2. Type several characters using IME composition
3. Press Ctrl+Z

### Expected Results:
- ✅ IME composition should be undoable
- ⚠️ Undo granularity may differ from Latin input

### Actual Results:
```
Test Date: _____________
Browser: _______________
IME Language: _____________

Behavior: _____________________________

Notes:
```

---

## Test Scenario 8: Paste Operation Undo

**Purpose:** Verify paste operations are properly tracked in undo history.

### Steps:
1. Type: `original text`
2. Copy some text from another source
3. Paste it into the editor
4. Press Ctrl+Z

### Expected Results:
- ✅ Paste should be undone as a single operation
- ✅ Original text should remain

### Actual Results:
```
Test Date: _____________
Browser: _______________
Pass/Fail: _____________

Notes:
```

---

## Summary of Findings

### Known Issues:

1. **Programmatic text modifications may corrupt undo stack**
   - Severity: HIGH
   - Impact: Users cannot undo auto-corrections or programmatic changes
   - Browsers affected: TBD (test and document)

2. **Undo granularity varies by browser**
   - Severity: MEDIUM
   - Impact: Inconsistent user experience across browsers
   - Browsers affected: TBD

### Recommendations for Auto-Correction:

Based on test results, choose one approach:

#### Option A: No Programmatic Changes (Safest)
- Only validate on blur/save
- Suggest corrections, don't apply automatically
- Preserve 100% undo functionality

#### Option B: Custom Undo Stack (Complex)
- Implement full custom undo/redo
- Track all changes manually
- Complete control but high implementation cost

#### Option C: Limited Programmatic Changes (Compromise)
- Only apply corrections at specific trigger points
- Clear communication to user about undo limitations
- Document known issues

#### Option D: Browser-Specific Implementation (Most Work)
- Test each browser thoroughly
- Implement workarounds per browser
- High maintenance burden

---

## Testing Checklist

- [ ] Test Scenario 1 completed
- [ ] Test Scenario 2 completed
- [ ] Test Scenario 3 completed
- [ ] Test Scenario 4 completed
- [ ] Test Scenario 5 completed
- [ ] Test Scenario 6 completed (all browsers)
- [ ] Test Scenario 7 completed
- [ ] Test Scenario 8 completed
- [ ] Findings documented
- [ ] Recommendations reviewed
- [ ] Decision made on auto-correction approach

---

**Document completed by:** GitHub Copilot  
**Testing to be completed by:** Engineering team  
**Next steps:** Execute test scenarios and document actual results
