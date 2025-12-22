import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import CalendarMonth from '../CalendarMonth';

function makeReq(start, end, status='approved'){
  return { start_date: start, end_date: end, status };
}

test('clicking selects start then end then resets start', () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;

  const onSelect = jest.fn();
  const { getByText, container } = render(<CalendarMonth year={y} month={m} vacationRequests={[makeReq('2025-12-01','2025-12-03')]} onSelect={onSelect} />);

  // find a day element for day 5 (should be in month)
  const day5 = getByText('5');
  fireEvent.click(day5);
  expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ start: expect.any(String), end: null }));

  const day7 = getByText('7');
  fireEvent.click(day7);
  expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ start: expect.any(String), end: expect.any(String) }));

  // third click should reset start
  const day10 = getByText('10');
  fireEvent.click(day10);
  expect(onSelect).toHaveBeenLastCalledWith({ start: expect.any(String), end: null });
});

test('cannot select approved vacation day', () => {
  // create approved vacation on day 15
  const onSelect = jest.fn();
  const { getByText } = render(<CalendarMonth year={2025} month={12} vacationRequests={[makeReq('2025-12-15','2025-12-15','approved')]} onSelect={onSelect} />);
  const day15 = getByText('15');
  // approved days should have title and aria-disabled
  expect(day15).toHaveAttribute('title', 'Genehmigter Urlaub — nicht auswählbar');
  expect(day15).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(day15);
  // click should be ignored; onSelect should not have start set to 15
  expect(onSelect).not.toHaveBeenCalled();
});

test('pending day is selectable', () => {
  const onSelect = jest.fn();
  const { getByText } = render(<CalendarMonth year={2025} month={12} vacationRequests={[makeReq('2025-12-12','2025-12-12','pending')]} onSelect={onSelect} />);
  const day12 = getByText('12');
  expect(day12).toHaveAttribute('title', 'Ausstehender Urlaubsantrag');
  fireEvent.click(day12);
  expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ start: expect.any(String), end: null }));
});

test('day after approved vacation is selectable as start', () => {
  const onSelect = jest.fn();
  // approved vacation on 14-15, selecting 16 should be allowed
  const { getByText } = render(<CalendarMonth year={2025} month={12} vacationRequests={[makeReq('2025-12-14','2025-12-15','approved')]} onSelect={onSelect} />);
  const day16 = getByText('16');
  fireEvent.click(day16);
  expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ start: expect.stringContaining('2025-12-16'), end: null }));
});

test('navigation changes month label', () => {
  const onSelect = jest.fn();
  const { getByText } = render(<CalendarMonth year={2025} month={11} onSelect={onSelect} />);
  // initial label should show November
  expect(getByText(/November 2025/)).toBeTruthy();

  const next = getByText('▶');
  fireEvent.click(next);
  expect(getByText(/Dezember 2025/)).toBeTruthy();

  const prev = getByText('◀');
  fireEvent.click(prev);
  fireEvent.click(prev);
  expect(getByText(/Oktober 2025/)).toBeTruthy();
});