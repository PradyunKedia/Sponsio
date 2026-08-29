const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const abi = ethers.AbiCoder.defaultAbiCoder();
const ROOM_A = ethers.keccak256(ethers.toUtf8Bytes("ROOM-A"));
const ROOM_B = ethers.keccak256(ethers.toUtf8Bytes("ROOM-B"));
const STAKE = ethers.parseEther("0.001");

function leaf(roomId, address, amount) {
  return ethers.keccak256(abi.encode(
    ["bytes32", "address", "uint256"],
    [roomId, address, amount],
  ));
}

function hashPair(a, b) {
  return ethers.keccak256(ethers.concat(a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]));
}

function merkleTree(leaves) {
  const layers = [leaves];
  while (layers.at(-1).length > 1) {
    const current = layers.at(-1);
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(i + 1 < current.length ? hashPair(current[i], current[i + 1]) : current[i]);
    }
    layers.push(next);
  }
  return {
    root: layers.at(-1)[0],
    proof(index) {
      const result = [];
      for (let level = 0; level < layers.length - 1; level += 1) {
        const sibling = index % 2 === 0 ? index + 1 : index - 1;
        if (sibling < layers[level].length) result.push(layers[level][sibling]);
        index = Math.floor(index / 2);
      }
      return result;
    },
  };
}

describe("Sponsio", function () {
  let sponsio;
  let creator;
  let operator;
  let players;

  beforeEach(async function () {
    [creator, operator, ...players] = await ethers.getSigners();
    sponsio = await ethers.deployContract("Sponsio");
  });

  async function createRoom(roomId = ROOM_A, maxPlayers = 100) {
    const now = await time.latest();
    const deadlines = {
      join: now + 1000,
      game: now + 1100,
      settle: now + 1200,
      claim: now + 1300,
    };
    await sponsio.createRoom(
      roomId,
      operator.address,
      STAKE,
      maxPlayers,
      deadlines.join,
    );
    return deadlines;
  }

  it("isolates rooms and rejects duplicate joins", async function () {
    await createRoom(ROOM_A);
    await createRoom(ROOM_B);
    await sponsio.connect(players[0]).joinRoom(ROOM_A, { value: STAKE });
    await expect(
      sponsio.connect(players[0]).joinRoom(ROOM_A, { value: STAKE }),
    ).to.be.revertedWith("Already joined");
    await sponsio.connect(players[0]).joinRoom(ROOM_B, { value: STAKE });

    expect((await sponsio.getRoom(ROOM_A)).playerCount).to.equal(1);
    expect((await sponsio.getRoom(ROOM_B)).playerCount).to.equal(1);
  });

  it("supports an arbitrary odd-sized room", async function () {
    await createRoom(ROOM_A, 5);
    for (let i = 0; i < 5; i += 1) {
      await sponsio.connect(players[i]).joinRoom(ROOM_A, { value: STAKE });
    }
    expect((await sponsio.getRoom(ROOM_A)).playerCount).to.equal(5);
  });

  it("enforces capacity and exact stake", async function () {
    await createRoom(ROOM_A, 2);
    await expect(
      sponsio.connect(players[0]).joinRoom(ROOM_A, { value: 0 }),
    ).to.be.revertedWith("Incorrect stake");
    await sponsio.connect(players[0]).joinRoom(ROOM_A, { value: STAKE });
    await sponsio.connect(players[1]).joinRoom(ROOM_A, { value: STAKE });
    await expect(
      sponsio.connect(players[2]).joinRoom(ROOM_A, { value: STAKE }),
    ).to.be.revertedWith("Room is full");
  });

  it("accepts 100 independently funded players", async function () {
    this.timeout(30_000);
    await createRoom(ROOM_A, 100);
    for (let i = 0; i < 100; i += 1) {
      const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
      await network.provider.send("hardhat_setBalance", [
        wallet.address,
        "0x56BC75E2D63100000",
      ]);
      await sponsio.connect(wallet).joinRoom(ROOM_A, { value: STAKE });
    }
    expect((await sponsio.getRoom(ROOM_A)).playerCount).to.equal(100);
  });

  it("commits a payout root and permits proof-based claims once", async function () {
    const deadlines = await createRoom();
    await sponsio.connect(players[0]).joinRoom(ROOM_A, { value: STAKE });
    await sponsio.connect(players[1]).joinRoom(ROOM_A, { value: STAKE });
    await sponsio.connect(operator).startRoom(
      ROOM_A,
      deadlines.game,
      deadlines.settle,
      deadlines.claim,
    );
    await time.increaseTo(deadlines.game);

    const amounts = [STAKE + STAKE / 2n, STAKE / 2n];
    const leaves = [
      leaf(ROOM_A, players[0].address, amounts[0]),
      leaf(ROOM_A, players[1].address, amounts[1]),
    ];
    const tree = merkleTree(leaves);
    await sponsio.connect(operator).commitSettlement(
      ROOM_A,
      0,
      ethers.keccak256(ethers.toUtf8Bytes("state")),
      tree.root,
      STAKE * 2n,
    );

    await expect(
      sponsio.connect(players[0]).claim(ROOM_A, amounts[0], tree.proof(0)),
    ).to.changeEtherBalances([sponsio, players[0]], [-amounts[0], amounts[0]]);
    await expect(
      sponsio.connect(players[0]).claim(ROOM_A, amounts[0], tree.proof(0)),
    ).to.be.revertedWith("Already claimed");
    await expect(
      sponsio.connect(players[1]).claim(ROOM_A, amounts[0], tree.proof(1)),
    ).to.be.revertedWith("Invalid proof");
  });

  it("rejects unauthorized and malformed settlements", async function () {
    const deadlines = await createRoom();
    await sponsio.connect(players[0]).joinRoom(ROOM_A, { value: STAKE });
    await sponsio.connect(players[1]).joinRoom(ROOM_A, { value: STAKE });
    await sponsio.connect(operator).startRoom(
      ROOM_A,
      deadlines.game,
      deadlines.settle,
      deadlines.claim,
    );
    await time.increaseTo(deadlines.game);
    const root = leaf(ROOM_A, players[0].address, STAKE * 2n);
    const stateRoot = ethers.keccak256(ethers.toUtf8Bytes("state"));

    await expect(
      sponsio.connect(players[0]).commitSettlement(ROOM_A, 0, stateRoot, root, STAKE * 2n),
    ).to.be.revertedWith("Not room operator");
    await expect(
      sponsio.connect(operator).commitSettlement(ROOM_A, 0, stateRoot, root, STAKE),
    ).to.be.revertedWith("Payout must equal pool");
  });

  it("allows individual refunds after a missed settlement deadline", async function () {
    const deadlines = await createRoom();
    await sponsio.connect(players[0]).joinRoom(ROOM_A, { value: STAKE });
    await sponsio.connect(players[1]).joinRoom(ROOM_A, { value: STAKE });
    await sponsio.connect(operator).startRoom(
      ROOM_A,
      deadlines.game,
      deadlines.settle,
      deadlines.claim,
    );
    await time.increaseTo(deadlines.settle + 1);
    await expect(
      sponsio.connect(players[0]).refund(ROOM_A),
    ).to.changeEtherBalances([sponsio, players[0]], [-STAKE, STAKE]);
    await expect(sponsio.connect(players[0]).refund(ROOM_A)).to.be.revertedWith("Already refunded");
  });
});
