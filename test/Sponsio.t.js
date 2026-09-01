const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Sponsio", function () {
  let sponsio;
  let owner, p1, p2, p3, p4;

  beforeEach(async function () {
    [owner, p1, p2, p3, p4] = await ethers.getSigners();
    const Sponsio = await ethers.getContractFactory("Sponsio");
    sponsio = await Sponsio.deploy();
  });

  it("Should allow participants to join", async function () {
    await sponsio.connect(p1).joinGame();
    await sponsio.connect(p2).joinGame();
    
    const participant1 = await sponsio.participants(p1.address);
    expect(participant1.hasJoined).to.be.true;
    expect(participant1.switchCount).to.equal(0);
  });

  it("Should start the game and pair participants fairly with 1 backer each", async function () {
    await sponsio.connect(p1).joinGame();
    await sponsio.connect(p2).joinGame();
    await sponsio.connect(p3).joinGame();
    await sponsio.connect(p4).joinGame();

    await sponsio.connect(owner).startGame();

    expect(await sponsio.isGameStarted()).to.be.true;
    expect(await sponsio.numProfiles()).to.equal(4);

    // Verify paired initial targets
    const part0 = await sponsio.participants(p1.address);
    const part1 = await sponsio.participants(p2.address);
    expect(part0.targetProfile).to.equal(1);
    expect(part1.targetProfile).to.equal(0);

    // Each profile should have exactly 1 backer initially
    const prof0 = await sponsio.profiles(0);
    const prof1 = await sponsio.profiles(1);
    expect(prof0.headCount).to.equal(1);
    expect(prof1.headCount).to.equal(1);
  });

  it("Should apply loyalty penalty on switch", async function () {
    await sponsio.connect(p1).joinGame();
    await sponsio.connect(p2).joinGame();
    await sponsio.connect(p3).joinGame();
    await sponsio.connect(p4).joinGame();

    await sponsio.connect(owner).startGame();

    // p1 initially backs profile 1, now switches to profile 2
    await sponsio.connect(p1).switchProfile(2);

    const part1 = await sponsio.participants(p1.address);
    expect(part1.switchCount).to.equal(1);
    expect(part1.targetProfile).to.equal(2);

    // Profile 2 gets p1's penalized active equity (850 instead of 1000) + initial 1000 = 1850
    const prof2 = await sponsio.profiles(2);
    expect(prof2.totalActiveEquity).to.equal(1850);
  });

  it("Should determine winner and allow claiming", async function () {
    await sponsio.connect(p1).joinGame();
    await sponsio.connect(p2).joinGame();
    await sponsio.connect(p3).joinGame();
    await sponsio.connect(p4).joinGame();

    await sponsio.connect(owner).startGame();

    // p3 switches to back profile 0 (so profile 0 has 2 backers: p2 and p3)
    await sponsio.connect(p3).switchProfile(0);

    // Fast-forward 101 seconds
    await ethers.provider.send("evm_increaseTime", [101]);
    await ethers.provider.send("evm_mine");

    await sponsio.connect(owner).determineWinner();

    expect(await sponsio.winningProfile()).to.equal(0);
    expect(await sponsio.winnerDetermined()).to.equal(true);

    // p2 claims prize
    await expect(sponsio.connect(p2).claimPrize())
      .to.emit(sponsio, "PrizeClaimed");

    const part2 = await sponsio.participants(p2.address);
    expect(part2.hasClaimed).to.be.true;
  });
});
