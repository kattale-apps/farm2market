import test from "node:test";
import assert from "node:assert/strict";
import {
  isCommunityDetailsGpsRow,
  isCommunityResponseGpsRow,
  isFarmToolboxGpsField,
  isLikelyGpsCoordinateText,
} from "../app/utils/pdfGpsUtils";

test("detects coordinate text reliably", () => {
  assert.equal(isLikelyGpsCoordinateText("0.34712, 32.58252"), true);
  assert.equal(isLikelyGpsCoordinateText("-1.23456, 36.78901 (±8m)"), true);
  assert.equal(isLikelyGpsCoordinateText("N/A"), false);
  assert.equal(isLikelyGpsCoordinateText("unknown location"), false);
});

test("detects Farm Toolbox GPS field labels", () => {
  assert.equal(isFarmToolboxGpsField("GPS"), true);
  assert.equal(isFarmToolboxGpsField(" gps "), true);
  assert.equal(isFarmToolboxGpsField("Location"), false);
});

test("detects community details GPS rows", () => {
  assert.equal(isCommunityDetailsGpsRow("GPS", "N/A"), true);
  assert.equal(isCommunityDetailsGpsRow("Tracked Unit", "0.34712, 32.58252"), true);
  assert.equal(isCommunityDetailsGpsRow("Tracked Unit", "Banana Plot A"), false);
});

test("detects community response GPS rows by field type", () => {
  assert.equal(
    isCommunityResponseGpsRow({ fieldType: "gps", label: "Farm Pin", response: "N/A" }),
    true
  );
  assert.equal(
    isCommunityResponseGpsRow({ fieldType: "text", label: "GPS pin", response: "N/A" }),
    true
  );
  assert.equal(
    isCommunityResponseGpsRow({ fieldType: "text", label: "Plot", response: "0.34712, 32.58252" }),
    true
  );
  assert.equal(
    isCommunityResponseGpsRow({ fieldType: "text", label: "Plot", response: "healthy crop" }),
    false
  );
});
