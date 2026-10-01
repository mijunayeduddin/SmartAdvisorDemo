import { SeatAvailabilityPublisher } from '../core/observer';

describe('SeatAvailabilityPublisher (Observer Pattern)', () => {
  let publisher: SeatAvailabilityPublisher;

  beforeEach(() => {
    publisher = new SeatAvailabilityPublisher();
  });

  afterEach(() => {
    publisher.clear();
  });

  test('notifies global subscribers immediately on seat update', () => {
    const received: any[] = [];
    publisher.subscribe((event) => {
      received.push(event);
    });

    const event = publisher.notifySeatUpdate({
      sectionId: 'sec-101',
      courseCode: 'CSE115',
      sectionNumber: 1,
      seatsAvailable: 15
    });

    expect(received.length).toBe(1);
    expect(received[0].type).toBe('SEAT_UPDATE');
    expect(received[0].payload.sectionId).toBe('sec-101');
    expect(received[0].payload.seatsAvailable).toBe(15);
    expect(received[0].payload.isFull).toBe(false);
  });

  test('marks isFull = true when seatsAvailable is 0', () => {
    const received: any[] = [];
    publisher.subscribe((event) => {
      received.push(event);
    });

    publisher.updateSeats('sec-full', 0, { courseCode: 'CSE173' });

    expect(received.length).toBe(1);
    expect(received[0].payload.seatsAvailable).toBe(0);
    expect(received[0].payload.isFull).toBe(true);
  });

  test('supports section-filtered subscriptions', () => {
    const sec1Events: any[] = [];
    const sec2Events: any[] = [];

    publisher.subscribeToSection('sec-1', (event) => sec1Events.push(event));
    publisher.subscribeToSection('sec-2', (event) => sec2Events.push(event));

    publisher.updateSeats('sec-1', 4);

    expect(sec1Events.length).toBe(1);
    expect(sec2Events.length).toBe(0);

    publisher.updateSeats('sec-2', 8);
    expect(sec1Events.length).toBe(1);
    expect(sec2Events.length).toBe(1);
  });

  test('supports course-filtered subscriptions', () => {
    const cse115Events: any[] = [];
    publisher.subscribeToCourse('CSE115', (event) => cse115Events.push(event));

    publisher.notifySeatUpdate({ sectionId: 'sec-1', courseCode: 'CSE115', seatsAvailable: 5 });
    publisher.notifySeatUpdate({ sectionId: 'sec-9', courseCode: 'ENG102', seatsAvailable: 2 });

    expect(cse115Events.length).toBe(1);
    expect(cse115Events[0].payload.courseCode).toBe('CSE115');
  });

  test('dispatches SCHEDULE_SYNC events for cross-device sync', () => {
    const syncEvents: any[] = [];
    publisher.subscribe((event) => {
      if (event.type === 'SCHEDULE_SYNC') syncEvents.push(event);
    });

    publisher.notifyScheduleSync({
      studentId: '2412800642',
      action: 'ENROLLED',
      section: { sectionId: 'sec-1' }
    });

    expect(syncEvents.length).toBe(1);
    expect(syncEvents[0].type).toBe('SCHEDULE_SYNC');
    expect(syncEvents[0].payload.studentId).toBe('2412800642');
  });

  test('unsubscribe removes subscriber cleanly', () => {
    let callCount = 0;
    const unsub = publisher.subscribe(() => {
      callCount++;
    });

    publisher.updateSeats('sec-1', 10);
    expect(callCount).toBe(1);

    unsub();
    publisher.updateSeats('sec-1', 9);
    expect(callCount).toBe(1);
  });
});
