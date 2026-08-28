// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BlitzConsensus {
    uint256 public constant V_0 = 1000;
    uint256 public constant DURATION = 100; // 100 seconds
    
    address public admin;
    uint256 public startTime;
    bool public isGameStarted;
    bool public isGameEnded;
    
    struct Participant {
        bool hasJoined;
        uint256 switchCount;
        uint256 lastSwitchTime;
        uint256 targetProfile;
        bool hasClaimed;
    }
    
    struct Profile {
        uint256 headCount;
        uint256 totalActiveEquity;
    }
    
    mapping(address => Participant) public participants;
    address[] public participantAddresses;
    
    mapping(uint256 => Profile) public profiles;
    uint256 public numProfiles;
    
    uint256 public winningProfile;
    uint256 public totalWinningEquity;
    bool public winnerDetermined;
    
    event GameStarted(uint256 startTime, uint256 numProfiles);
    event ParticipantJoined(address indexed participant);
    event SwitchedProfile(address indexed participant, uint256 oldProfile, uint256 newProfile, uint256 time);
    event GameEnded(uint256 winningProfile);
    event PrizeClaimed(address indexed participant, uint256 amount);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    function joinGame() external {
        require(!isGameStarted, "Game already started");
        require(!participants[msg.sender].hasJoined, "Already joined");
        
        participants[msg.sender] = Participant({
            hasJoined: true,
            switchCount: 0,
            lastSwitchTime: 0, // Will be updated relative to startTime
            targetProfile: 0, // Unassigned yet
            hasClaimed: false
        });
        participantAddresses.push(msg.sender);
        
        emit ParticipantJoined(msg.sender);
    }
    
    function startGame() external onlyAdmin {
        require(!isGameStarted, "Already started");
        require(participantAddresses.length % 2 == 0, "Needs even number of participants");
        require(participantAddresses.length > 0, "No participants");
        
        numProfiles = participantAddresses.length / 2;
        startTime = block.timestamp;
        isGameStarted = true;
        
        // Pairwise assignment
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address pAddr = participantAddresses[i];
            uint256 assignedProfile = i / 2;
            participants[pAddr].targetProfile = assignedProfile;
            profiles[assignedProfile].headCount += 1;
            profiles[assignedProfile].totalActiveEquity += V_0;
        }
        
        emit GameStarted(startTime, numProfiles);
    }
    
    // Loyalty Curve L(s) * 100 (for precision)
    function getLoyaltyMultiplier(uint256 s) public pure returns (uint256) {
        if (s == 0) return 100;
        if (s == 1) return 85;
        if (s == 2) return 60;
        if (s == 3) return 40;
        return 15;
    }
    
    function switchProfile(uint256 newProfile) external {
        require(isGameStarted, "Game not started");
        require(block.timestamp <= startTime + DURATION, "Game window ended");
        require(newProfile < numProfiles, "Invalid profile");
        
        Participant storage p = participants[msg.sender];
        require(p.hasJoined, "Not a participant");
        require(p.targetProfile != newProfile, "Already on this profile");
        
        uint256 oldProfile = p.targetProfile;
        uint256 timeElapsed = block.timestamp - startTime;
        
        // Remove from old profile
        uint256 oldEquity = V_0 * getLoyaltyMultiplier(p.switchCount) / 100;
        profiles[oldProfile].headCount -= 1;
        profiles[oldProfile].totalActiveEquity -= oldEquity;
        
        // Update participant state
        p.switchCount += 1;
        p.lastSwitchTime = timeElapsed;
        p.targetProfile = newProfile;
        
        // Add to new profile
        uint256 newEquity = V_0 * getLoyaltyMultiplier(p.switchCount) / 100;
        profiles[newProfile].headCount += 1;
        profiles[newProfile].totalActiveEquity += newEquity;
        
        emit SwitchedProfile(msg.sender, oldProfile, newProfile, timeElapsed);
    }
    
    function determineWinner() external {
        require(isGameStarted, "Game not started");
        require(block.timestamp > startTime + DURATION, "Game still running");
        require(!winnerDetermined, "Winner already determined");
        
        uint256 bestProfile = 0;
        uint256 maxHeadcount = 0;
        uint256 maxEquityForTie = 0;
        
        for (uint256 i = 0; i < numProfiles; i++) {
            uint256 hc = profiles[i].headCount;
            uint256 eq = profiles[i].totalActiveEquity;
            
            if (hc > maxHeadcount) {
                maxHeadcount = hc;
                bestProfile = i;
                maxEquityForTie = eq;
            } else if (hc == maxHeadcount) {
                // Tie breaker on TVL / Equity
                if (eq > maxEquityForTie) {
                    bestProfile = i;
                    maxEquityForTie = eq;
                }
            }
        }
        
        winningProfile = bestProfile;
        winnerDetermined = true;
        isGameEnded = true;
        
        // Calculate total effective claim shares for the winning profile
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address pAddr = participantAddresses[i];
            Participant storage p = participants[pAddr];
            if (p.targetProfile == winningProfile) {
                totalWinningEquity += calculateEffectiveShares(pAddr);
            }
        }
        
        emit GameEnded(winningProfile);
    }
    
    // T(t) = 1.00 - 0.002 * t
    // E_i = A_i * T(t_i)
    function calculateEffectiveShares(address pAddr) public view returns (uint256) {
        Participant memory p = participants[pAddr];
        uint256 activeEquity = V_0 * getLoyaltyMultiplier(p.switchCount) / 100;
        // T(t) in per-mille (1000 based)
        // 1.00 -> 1000, 0.002 * t -> 2 * t
        uint256 t = p.lastSwitchTime;
        if (t > 100) t = 100;
        uint256 timeMultiplier = 1000 - (2 * t);
        
        return (activeEquity * timeMultiplier) / 1000;
    }
    
    function getClaimShare(address pAddr) public view returns (uint256) {
        require(winnerDetermined, "Winner not determined");
        Participant memory p = participants[pAddr];
        if (p.targetProfile != winningProfile) {
            return 0;
        }
        if (totalWinningEquity == 0) return 0;
        
        uint256 myShares = calculateEffectiveShares(pAddr);
        uint256 globalPrizePool = participantAddresses.length * V_0;
        
        return (globalPrizePool * myShares) / totalWinningEquity;
    }
    
    // Allows winner backer to claim. Since there are no real funds in the hackathon MVP,
    // this simply marks them as claimed and emits an event.
    function claimPrize() external {
        require(winnerDetermined, "Winner not determined");
        Participant storage p = participants[msg.sender];
        require(p.hasJoined, "Not a participant");
        require(p.targetProfile == winningProfile, "Not a backer of the winning profile");
        require(!p.hasClaimed, "Already claimed");
        
        uint256 claimAmount = getClaimShare(msg.sender);
        require(claimAmount > 0, "No prize to claim");
        
        p.hasClaimed = true;
        
        emit PrizeClaimed(msg.sender, claimAmount);
    }
}
