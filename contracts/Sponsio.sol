// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Sponsio {
    uint16 public constant MAX_PLAYERS = 100;

    enum RoomStatus {
        None,
        Open,
        Locked,
        Settled,
        Refunding,
        Finalized
    }

    struct Room {
        address creator;
        address operator;
        uint128 stake;
        uint16 maxPlayers;
        uint16 playerCount;
        uint64 joinDeadline;
        uint64 gameEnd;
        uint64 settleDeadline;
        uint64 claimDeadline;
        uint256 pool;
        uint256 claimedAmount;
        uint256 winningProfile;
        bytes32 stateRoot;
        bytes32 payoutsRoot;
        RoomStatus status;
    }

    mapping(bytes32 => Room) private rooms;
    mapping(bytes32 => mapping(address => bool)) public hasJoined;
    mapping(bytes32 => mapping(address => bool)) public hasClaimed;

    uint256 private unlocked = 1;

    event RoomCreated(
        bytes32 indexed roomId,
        address indexed creator,
        address indexed operator,
        uint256 stake,
        uint16 maxPlayers,
        uint64 joinDeadline
    );
    event Joined(bytes32 indexed roomId, address indexed player, uint256 stake);
    event SettlementCommitted(
        bytes32 indexed roomId,
        uint256 indexed winningProfile,
        bytes32 stateRoot,
        bytes32 payoutsRoot,
        uint256 totalPayout
    );
    event Claimed(bytes32 indexed roomId, address indexed player, uint256 amount);
    event Refunded(bytes32 indexed roomId, address indexed player, uint256 amount);
    event RoomFinalized(bytes32 indexed roomId, uint256 unclaimedAmount);

    modifier nonReentrant() {
        require(unlocked == 1, "Reentrant call");
        unlocked = 2;
        _;
        unlocked = 1;
    }

    function createRoom(
        bytes32 roomId,
        address operator,
        uint128 stake,
        uint16 maxPlayers,
        uint64 joinDeadline
    ) external {
        require(roomId != bytes32(0), "Invalid room id");
        require(rooms[roomId].status == RoomStatus.None, "Room already exists");
        require(operator != address(0), "Invalid operator");
        require(maxPlayers >= 2 && maxPlayers <= MAX_PLAYERS, "Invalid capacity");
        require(joinDeadline > block.timestamp, "Join deadline passed");

        rooms[roomId] = Room({
            creator: msg.sender,
            operator: operator,
            stake: stake,
            maxPlayers: maxPlayers,
            playerCount: 0,
            joinDeadline: joinDeadline,
            gameEnd: 0,
            settleDeadline: 0,
            claimDeadline: 0,
            pool: 0,
            claimedAmount: 0,
            winningProfile: 0,
            stateRoot: bytes32(0),
            payoutsRoot: bytes32(0),
            status: RoomStatus.Open
        });

        emit RoomCreated(
            roomId,
            msg.sender,
            operator,
            stake,
            maxPlayers,
            joinDeadline
        );
    }

    function startRoom(
        bytes32 roomId,
        uint64 gameEnd,
        uint64 settleDeadline,
        uint64 claimDeadline
    ) external {
        Room storage room = rooms[roomId];
        require(room.status == RoomStatus.Open, "Room cannot be started");
        require(msg.sender == room.operator, "Not room operator");
        require(room.playerCount >= 2, "Not enough players");
        require(block.timestamp <= room.joinDeadline, "Lobby deadline passed");
        require(gameEnd > block.timestamp, "Invalid game end");
        require(settleDeadline > gameEnd, "Invalid settle deadline");
        require(claimDeadline > settleDeadline, "Invalid claim deadline");
        room.gameEnd = gameEnd;
        room.settleDeadline = settleDeadline;
        room.claimDeadline = claimDeadline;
        room.status = RoomStatus.Locked;
    }

    function joinRoom(bytes32 roomId) external payable {
        Room storage room = rooms[roomId];
        require(room.status == RoomStatus.Open, "Room is not open");
        require(block.timestamp <= room.joinDeadline, "Joining closed");
        require(room.playerCount < room.maxPlayers, "Room is full");
        require(!hasJoined[roomId][msg.sender], "Already joined");
        require(msg.value == room.stake, "Incorrect stake");

        hasJoined[roomId][msg.sender] = true;
        room.playerCount += 1;
        room.pool += msg.value;
        emit Joined(roomId, msg.sender, msg.value);
    }

    function commitSettlement(
        bytes32 roomId,
        uint256 winningProfile,
        bytes32 stateRoot,
        bytes32 payoutsRoot,
        uint256 totalPayout
    ) external {
        Room storage room = rooms[roomId];
        require(room.status == RoomStatus.Locked, "Room cannot be settled");
        require(msg.sender == room.operator, "Not room operator");
        require(block.timestamp >= room.gameEnd, "Game still running");
        require(block.timestamp <= room.settleDeadline, "Settlement deadline passed");
        require(room.playerCount >= 2, "Not enough players");
        require(stateRoot != bytes32(0), "Invalid state root");
        require(payoutsRoot != bytes32(0), "Invalid payouts root");
        require(totalPayout == room.pool, "Payout must equal pool");

        room.winningProfile = winningProfile;
        room.stateRoot = stateRoot;
        room.payoutsRoot = payoutsRoot;
        room.status = RoomStatus.Settled;

        emit SettlementCommitted(
            roomId,
            winningProfile,
            stateRoot,
            payoutsRoot,
            totalPayout
        );
    }

    function claim(
        bytes32 roomId,
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant {
        Room storage room = rooms[roomId];
        require(room.status == RoomStatus.Settled, "Claims are not open");
        require(block.timestamp <= room.claimDeadline, "Claim deadline passed");
        require(hasJoined[roomId][msg.sender], "Not a room player");
        require(!hasClaimed[roomId][msg.sender], "Already claimed");
        require(amount > 0, "No payout");

        bytes32 leaf = keccak256(abi.encode(roomId, msg.sender, amount));
        require(_verifyProof(proof, room.payoutsRoot, leaf), "Invalid proof");

        hasClaimed[roomId][msg.sender] = true;
        room.claimedAmount += amount;
        require(room.claimedAmount <= room.pool, "Pool exceeded");
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Payout failed");
        emit Claimed(roomId, msg.sender, amount);
    }

    function refund(bytes32 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        require(
            room.status == RoomStatus.Open ||
            room.status == RoomStatus.Locked ||
            room.status == RoomStatus.Refunding,
            "Refund unavailable"
        );
        uint256 refundAfter = room.status == RoomStatus.Open ? room.joinDeadline : room.settleDeadline;
        require(block.timestamp > refundAfter, "Settlement still possible");
        require(hasJoined[roomId][msg.sender], "Not a room player");
        require(!hasClaimed[roomId][msg.sender], "Already refunded");

        room.status = RoomStatus.Refunding;
        hasClaimed[roomId][msg.sender] = true;
        room.claimedAmount += room.stake;
        (bool sent, ) = payable(msg.sender).call{value: room.stake}("");
        require(sent, "Refund failed");
        emit Refunded(roomId, msg.sender, room.stake);
    }

    function finalizeRoom(bytes32 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        require(msg.sender == room.creator, "Not room creator");
        require(room.status == RoomStatus.Settled || room.status == RoomStatus.Refunding, "Cannot finalize");
        require(block.timestamp > room.claimDeadline, "Claims still open");

        uint256 unclaimed = room.pool - room.claimedAmount;
        room.status = RoomStatus.Finalized;
        if (unclaimed > 0) {
            (bool sent, ) = payable(room.creator).call{value: unclaimed}("");
            require(sent, "Finalization failed");
        }
        emit RoomFinalized(roomId, unclaimed);
    }

    function getRoom(bytes32 roomId) external view returns (Room memory) {
        return rooms[roomId];
    }

    function _verifyProof(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) private pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 sibling = proof[i];
            computed = computed < sibling
                ? keccak256(abi.encodePacked(computed, sibling))
                : keccak256(abi.encodePacked(sibling, computed));
        }
        return computed == root;
    }
}
