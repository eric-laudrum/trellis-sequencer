const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomStore } = require('./RoomStore');

const createStore = () => new RoomStore(() => 0.123456);

test('public rooms are listed and joinable without approval', () => {
    const store = createStore();
    const { room } = store.createRoom({ name: 'Open room', access: 'public', hostId: 'host' });

    assert.deepEqual(store.getListedRooms(), [{
        id: '123456', name: 'Open room', access: 'public', count: 1,
    }]);
    assert.equal(store.requestJoin(room.id, 'guest', 'Guest').status, 'joined');
    assert.equal(room.members.has('guest'), true);
});

test('locked rooms require host approval and pending guests are not members', () => {
    const store = createStore();
    const { room } = store.createRoom({ name: 'Locked room', access: 'locked', hostId: 'host' });

    const result = store.requestJoin(room.id, 'guest', 'Ada');
    assert.equal(result.status, 'pending');
    assert.equal(result.request.name, 'Ada');
    assert.equal(room.members.has('guest'), false);

    const response = store.respondToJoin('host', room.id, 'guest', true);
    assert.equal(response.request.id, 'guest');
    assert.equal(room.members.has('guest'), true);
    assert.equal(room.pendingRequests.size, 0);
});

test('a host can deny a locked-room request', () => {
    const store = createStore();
    const { room } = store.createRoom({ name: 'Locked room', access: 'locked', hostId: 'host' });
    store.requestJoin(room.id, 'guest', 'Ada');

    assert.equal(store.respondToJoin('host', room.id, 'guest', false).error, undefined);
    assert.equal(room.members.has('guest'), false);
    assert.equal(room.pendingRequests.size, 0);
});

test('non-hosts cannot approve requests or change privacy', () => {
    const store = createStore();
    const { room } = store.createRoom({ name: 'Locked room', access: 'locked', hostId: 'host' });
    store.requestJoin(room.id, 'guest', 'Ada');

    assert.match(store.respondToJoin('guest', room.id, 'guest', true).error, /Only the room host/);
    assert.match(store.updateAccess('guest', room.id, 'public').error, /Only the room host/);
    assert.equal(room.members.has('guest'), false);
    assert.equal(room.access, 'locked');
});

test('invisible rooms are unlisted but joinable by their exact room number', () => {
    const store = createStore();
    const { room } = store.createRoom({ name: 'Secret room', access: 'invisible', hostId: 'host' });

    assert.deepEqual(store.getListedRooms(), []);
    assert.match(store.requestJoin('999999', 'guest', 'Ada').error, /No room was found/);
    assert.equal(store.requestJoin(room.id, 'guest', 'Ada').status, 'joined');
});

test('changing away from locked denies all pending requests', () => {
    const store = createStore();
    const { room } = store.createRoom({ name: 'Locked room', access: 'locked', hostId: 'host' });
    store.requestJoin(room.id, 'guest-one', 'Ada');
    store.requestJoin(room.id, 'guest-two', 'Grace');

    const { deniedRequests } = store.updateAccess('host', room.id, 'invisible');
    assert.deepEqual(deniedRequests.map(request => request.id), ['guest-one', 'guest-two']);
    assert.equal(room.pendingRequests.size, 0);
});

test('cancelling a request removes it without admitting the guest', () => {
    const store = createStore();
    const { room } = store.createRoom({ name: 'Locked room', access: 'locked', hostId: 'host' });
    store.requestJoin(room.id, 'guest', 'Ada');

    assert.equal(store.cancelPending('guest', room.id).length, 1);
    assert.equal(room.pendingRequests.size, 0);
    assert.equal(room.members.has('guest'), false);
});

test('the last host leaving denies pending locked-room requests', () => {
    const store = createStore();
    const { room } = store.createRoom({ name: 'Room', access: 'locked', hostId: 'host' });
    store.requestJoin(room.id, 'guest', 'Ada');

    const result = store.leave(room.id, 'host');
    assert.equal(result.newHostId, null);
    assert.deepEqual(result.deniedRequests.map(request => request.id), ['guest']);
    assert.equal(room.pendingRequests.size, 0);
    assert.match(store.requestJoin(room.id, 'another-guest', 'Grace').error, /host is unavailable/);
});

test('hosting transfers to an admitted member when the host leaves', () => {
    const store = createStore();
    const { room } = store.createRoom({ name: 'Room', access: 'locked', hostId: 'host' });
    store.requestJoin(room.id, 'member', 'Ada');
    store.respondToJoin('host', room.id, 'member', true);

    const result = store.leave(room.id, 'host');
    assert.equal(result.newHostId, 'member');
    assert.equal(store.serializeRoom(room, 'member').isHost, true);
});
