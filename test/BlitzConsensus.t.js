const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("BlitzConsensus", function () {
  let blitzConsensus;
  let owner;
  let players;

  before(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    players = signers.slice(1, 11); // 10 players for simplicity
  });

  beforeEach(async function () {
    const BlitzConsensus = await ethers.getContractFactory("BlitzConsensus");
    blitzConsensus = await BlitzConsensus.deploy();
  });

  describe("Initialization and Game Start", function () {
    it("Should allow participants to join", async function () {
      await blitzConsensus.connect(players[0]).joinGame();
      const p = await blitzConsensus.participants(players[0].address);
      expect(p.hasJoined).to.be.true;
    });

    it("Should revert start game if not even participants", async function () {
      await blitzConsensus.connect(players[0]).joinGame();
      await expect(blitzConsensus.startGame()).to.be.revertedWith("Needs even number of participants");
    });

    it("Should assign pairs correctly on start game", async function () {
      for (let i = 0; i < 4; i++) {
        await blitzConsensus.connect(players[i]).joinGame();
      }
      await blitzConsensus.startGame();
      expect(await blitzConsensus.numProfiles()).to.equal(2);
      
      const profile0 = await blitzConsensus.profiles(0);
      const profile1 = await blitzConsensus.profiles(1);

      expect(profile0.headCount).to.equal(2);
      expect(profile1.headCount).to.equal(2);
      expect(profile0.totalActiveEquity).to.equal(2000);
      expect(profile1.totalActiveEquity).to.equal(2000);
    });
  });

  describe("Switching Profiles", function () {
    beforeEach(async function () {
      for (let i = 0; i < 4; i++) {
        await blitzConsensus.connect(players[i]).joinGame();
      }
      await blitzConsensus.startGame();
    });

    it("Should reduce active equity and adjust headcounts when switching", async function () {
      // player 0 is assigned to profile 0 initially
      await blitzConsensus.connect(players[0]).switchProfile(1);
      
      const profile0 = await blitzConsensus.profiles(0);
      const profile1 = await blitzConsensus.profiles(1);

      // player 0 leaves profile 0
      expect(profile0.headCount).to.equal(1);
      expect(profile0.totalActiveEquity).to.equal(1000);

      // player 0 joins profile 1
      // player 0 is on their 1st switch, L(1) = 0.85 -> Active Equity = 850
      expect(profile1.headCount).to.equal(3);
      expect(profile1.totalActiveEquity).to.equal(2000 + 850);
    });

    it("Should handle multiple switches with degradation", async function () {
      // Switch 1: L(1) = 0.85 -> 850
      await blitzConsensus.connect(players[0]).switchProfile(1);
      // Switch 2: L(2) = 0.60 -> 600
      await blitzConsensus.connect(players[0]).switchProfile(0);
      
      const profile0 = await blitzConsensus.profiles(0);
      const profile1 = await blitzConsensus.profiles(1);

      // After 2 switches, player 0 is back in profile 0
      expect(profile0.headCount).to.equal(2);
      expect(profile0.totalActiveEquity).to.equal(1600); // 1000 + 600

      expect(profile1.headCount).to.equal(2);
      expect(profile1.totalActiveEquity).to.equal(2000); // the remaining two
    });
  });

  describe("Settlement and Claims", function () {
    beforeEach(async function () {
      for (let i = 0; i < 4; i++) {
        await blitzConsensus.connect(players[i]).joinGame();
      }
      await blitzConsensus.startGame();
    });

    it("Should determine winner correctly based on headcount", async function () {
      await blitzConsensus.connect(players[0]).switchProfile(1); // Profile 1 has 3 hc, Profile 0 has 1
      await time.increase(101);
      await blitzConsensus.determineWinner();
      expect(await blitzConsensus.winningProfile()).to.equal(1);
    });

    it("Should calculate claim shares correctly", async function () {
      // p0 switches to 1 at t=10
      await time.increase(10);
      await blitzConsensus.connect(players[0]).switchProfile(1);
      
      await time.increase(91); // Pass the 100s mark
      await blitzConsensus.determineWinner();

      expect(await blitzConsensus.winningProfile()).to.equal(1);
      
      const shareP0 = await blitzConsensus.getClaimShare(players[0].address);
      const shareP2 = await blitzConsensus.getClaimShare(players[2].address);
      
      expect(shareP2).to.be.closeTo(1411, 2);
      expect(shareP0).to.be.closeTo(1176, 2);
    });
  });
});
