import React, { useState, useEffect, useCallback } from 'react';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { BN } from '@polkadot/util';

// Contract metadata - will be loaded from the built contract
import metadata from './metadata.json';

// Default configuration
const DEFAULT_WS_URL = 'wss://devnet02.xode.net';
const CONTRACT_ADDRESS = 'XqFfUXhebfpLLFKPKyb5uK7YJBxYjexFAm5UJKeg3VLvno8eA';

function App() {
  const [api, setApi] = useState(null);
  const [contract, setContract] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [contractAddress, setContractAddress] = useState(CONTRACT_ADDRESS);
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});

  // Form states
  const [horseId, setHorseId] = useState('');
  const [horseName, setHorseName] = useState('');
  const [betChoice, setBetChoice] = useState('');
  const [betAmount, setBetAmount] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [winnerFirst, setWinnerFirst] = useState('');
  const [winnerSecond, setWinnerSecond] = useState('');
  const [rewardBettor, setRewardBettor] = useState('');
  const [rewardAmount, setRewardAmount] = useState('');

  // Simulation states
  const [simLog, setSimLog] = useState([]);
  const [simRunning, setSimRunning] = useState(false);
  const [simPhase, setSimPhase] = useState('idle'); // idle, setup, betting, racing, results

  // Default horses for simulation
  const defaultHorses = [
    { id: 1, name: 'Thunder Bolt' },
    { id: 2, name: 'Silver Arrow' },
    { id: 3, name: 'Golden Star' },
    { id: 4, name: 'Dark Knight' },
    { id: 5, name: 'Wild Spirit' },
    { id: 6, name: 'Lucky Charm' },
  ];

  // Add log entry
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setSimLog(prev => [...prev, { timestamp, message, type }]);
  };

  // Clear logs
  const clearLogs = () => {
    setSimLog([]);
  };

  // Sleep helper
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Query contract and return value
  const queryContractValue = async (method) => {
    if (!contract || !selectedAccount) return null;
    
    try {
      const { result, output } = await contract.query[method](
        selectedAccount.address,
        { gasLimit: -1 }
      );
      if (result.isOk) {
        return output?.toHuman();
      }
    } catch (error) {
      console.error(error);
    }
    return null;
  };

  // Send transaction and wait for completion
  const sendTxAndWait = async (method, args, value = 0) => {
    if (!contract || !selectedAccount) {
      throw new Error('Contract or account not connected');
    }

    const injector = await web3FromAddress(selectedAccount.address);
    
    const { gasRequired } = await contract.query[method](
      selectedAccount.address,
      { gasLimit: -1, value },
      ...args
    );

    return new Promise((resolve, reject) => {
      contract.tx[method](
        { gasLimit: gasRequired, value },
        ...args
      ).signAndSend(selectedAccount.address, { signer: injector.signer }, ({ status, events }) => {
        if (status.isInBlock) {
          resolve(status.asInBlock.toHex());
        }
        if (status.isFinalized) {
          resolve(status.asFinalized.toHex());
        }
      }).catch(reject);
    });
  };

  // Simulate race - randomly pick winners
  const simulateRace = () => {
    const positions = [...defaultHorses].sort(() => Math.random() - 0.5);
    return {
      first: positions[0],
      second: positions[1],
      third: positions[2],
      all: positions,
    };
  };

  // Run full game simulation
  const runSimulation = async () => {
    if (!contract || !selectedAccount) {
      addLog('Please connect wallet and contract first!', 'error');
      return;
    }

    setSimRunning(true);
    clearLogs();

    try {
      // ============ PHASE 1: SETUP ============
      setSimPhase('setup');
      addLog('═══════════════════════════════════════', 'header');
      addLog('🏇 KARERA DS - HORSE RACING SIMULATION 🏇', 'header');
      addLog('═══════════════════════════════════════', 'header');
      addLog('');
      addLog('📋 PHASE 1: SETUP', 'phase');
      addLog('Setting up the race...', 'info');
      await sleep(1000);

      // Reset status to pending
      addLog('Resetting race status to PENDING (0)...', 'info');
      await sendTxAndWait('setStatus', [0]);
      addLog('✓ Status set to PENDING', 'success');
      await sleep(500);

      // Add horses
      addLog('Adding horses to the race...', 'info');
      for (const horse of defaultHorses) {
        const nameBytes = Array.from(new TextEncoder().encode(horse.name));
        try {
          await sendTxAndWait('addHorse', [horse.id, nameBytes]);
          addLog(`  ✓ Added Horse #${horse.id}: ${horse.name}`, 'success');
        } catch (e) {
          addLog(`  → Horse #${horse.id} may already exist, continuing...`, 'warning');
        }
        await sleep(300);
      }

      // Display horses
      addLog('');
      addLog('🐴 Horses in this race:', 'info');
      defaultHorses.forEach(h => {
        addLog(`   [${h.id}] ${h.name}`, 'info');
      });
      addLog('');

      // ============ PHASE 2: BETTING ============
      setSimPhase('betting');
      addLog('📋 PHASE 2: BETTING', 'phase');
      addLog('Opening betting window...', 'info');
      await sleep(1000);

      // Simulate some bets
      const simulatedBets = [
        { choice: [1, 2], amount: '1000000000000' }, // Bet on horses 1 & 2
        { choice: [3, 4], amount: '2000000000000' }, // Bet on horses 3 & 4
        { choice: [1, 5], amount: '1500000000000' }, // Bet on horses 1 & 5
      ];

      addLog(`Placing ${simulatedBets.length} simulated bets...`, 'info');
      for (let i = 0; i < simulatedBets.length; i++) {
        const bet = simulatedBets[i];
        const value = new BN(bet.amount);
        try {
          await sendTxAndWait('addBet', [bet.choice], value);
          addLog(`  ✓ Bet #${i + 1}: Horses [${bet.choice.join(', ')}] - Amount: ${(parseInt(bet.amount) / 1e12).toFixed(4)} tokens`, 'success');
        } catch (e) {
          addLog(`  ✗ Bet #${i + 1} failed: ${e.message}`, 'error');
        }
        await sleep(500);
      }
      addLog('');

      // ============ PHASE 3: RACE ============
      setSimPhase('racing');
      addLog('📋 PHASE 3: THE RACE', 'phase');
      addLog('Starting the race...', 'info');
      await sendTxAndWait('setStatus', [1]);
      addLog('✓ Race status set to STARTED', 'success');
      await sleep(1000);

      addLog('');
      addLog('🏁 AND THEY\'RE OFF! 🏁', 'race');
      addLog('');

      // Simulate the race with dramatic effect
      for (let lap = 1; lap <= 3; lap++) {
        addLog(`--- Lap ${lap}/3 ---`, 'race');
        const positions = [...defaultHorses].sort(() => Math.random() - 0.5);
        positions.forEach((horse, idx) => {
          const bar = '█'.repeat(6 - idx) + '░'.repeat(idx);
          addLog(`  ${bar} #${horse.id} ${horse.name}`, 'race');
        });
        addLog('');
        await sleep(1500);
      }

      // Final results
      const raceResult = simulateRace();
      addLog('🏆 FINAL RESULTS 🏆', 'race');
      addLog(`  🥇 1st Place: #${raceResult.first.id} ${raceResult.first.name}`, 'success');
      addLog(`  🥈 2nd Place: #${raceResult.second.id} ${raceResult.second.name}`, 'success');
      addLog(`  🥉 3rd Place: #${raceResult.third.id} ${raceResult.third.name}`, 'info');
      addLog('');

      // Set winners on contract
      addLog('Recording winners on blockchain...', 'info');
      await sendTxAndWait('setWinners', [raceResult.first.id, raceResult.second.id]);
      addLog('✓ Winners recorded!', 'success');
      await sleep(500);

      // Add winning combination
      await sendTxAndWait('addWinningCombination', [raceResult.first.id, raceResult.second.id]);
      addLog(`✓ Winning combination added: [${raceResult.first.id}, ${raceResult.second.id}]`, 'success');
      addLog('');

      // ============ PHASE 4: RESULTS ============
      setSimPhase('results');
      addLog('📋 PHASE 4: RESULTS & REWARDS', 'phase');
      
      // Mark race as finished
      await sendTxAndWait('setStatus', [2]);
      addLog('✓ Race status set to FINISHED', 'success');
      await sleep(500);

      // Check bets and calculate rewards
      addLog('Calculating rewards...', 'info');
      const bets = await queryContractValue('getBets');
      addLog(`Found ${bets?.Ok?.length || 0} bets to process`, 'info');

      // Simulate reward distribution
      let totalPot = 0;
      let winners = [];
      
      if (bets?.Ok) {
        bets.Ok.forEach((bet, idx) => {
          const betAmount = parseInt(bet.amount.replace(/,/g, '')) || 0;
          totalPot += betAmount;
          
          // Check if bet matches winners
          const betChoices = bet.choice.map(c => parseInt(c));
          if (betChoices.includes(raceResult.first.id) && betChoices.includes(raceResult.second.id)) {
            winners.push({ bettor: bet.bettor, amount: betAmount });
          }
        });
      }

      addLog(`Total pot: ${(totalPot / 1e12).toFixed(4)} tokens`, 'info');
      addLog(`Winning bets: ${winners.length}`, 'info');

      if (winners.length > 0) {
        const rewardPerWinner = Math.floor(totalPot / winners.length);
        addLog('');
        addLog('💰 DISTRIBUTING REWARDS 💰', 'reward');
        for (const winner of winners) {
          try {
            await sendTxAndWait('addReward', [winner.bettor, rewardPerWinner]);
            addLog(`  ✓ Reward of ${(rewardPerWinner / 1e12).toFixed(4)} tokens to ${winner.bettor.slice(0, 10)}...`, 'success');
          } catch (e) {
            addLog(`  ✗ Failed to add reward: ${e.message}`, 'error');
          }
        }
      } else {
        addLog('No winning bets this race. House wins!', 'warning');
      }

      addLog('');
      addLog('═══════════════════════════════════════', 'header');
      addLog('🎉 SIMULATION COMPLETE! 🎉', 'header');
      addLog('═══════════════════════════════════════', 'header');
      
      // Final state
      addLog('');
      addLog('📊 FINAL CONTRACT STATE:', 'phase');
      const finalStatus = await queryContractValue('getStatus');
      const finalWinners = await queryContractValue('getWinners');
      const finalRewards = await queryContractValue('getRewards');
      addLog(`  Status: ${finalStatus?.Ok === '0' ? 'Pending' : finalStatus?.Ok === '1' ? 'Started' : 'Finished'}`, 'info');
      addLog(`  Winners: [${finalWinners?.Ok?.join(', ') || 'N/A'}]`, 'info');
      addLog(`  Total Rewards: ${finalRewards?.Ok?.length || 0}`, 'info');

    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
    } finally {
      setSimRunning(false);
      setSimPhase('idle');
    }
  };

  // Quick reset simulation
  const resetSimulation = async () => {
    if (!contract || !selectedAccount) {
      addLog('Please connect wallet and contract first!', 'error');
      return;
    }

    setSimRunning(true);
    addLog('Resetting contract state...', 'info');

    try {
      await sendTxAndWait('setStatus', [0]);
      addLog('✓ Status reset to PENDING', 'success');
      await sendTxAndWait('setWinners', [0, 0]);
      addLog('✓ Winners reset', 'success');
      addLog('Contract reset complete!', 'success');
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
    } finally {
      setSimRunning(false);
    }
  };

  // Connect to wallet
  const connectWallet = async () => {
    try {
      setLoading(prev => ({ ...prev, wallet: true }));
      const extensions = await web3Enable('Karera DS Tester');
      
      if (extensions.length === 0) {
        setResults(prev => ({ 
          ...prev, 
          wallet: { error: 'No wallet extension found. Please install Polkadot.js extension.' }
        }));
        return;
      }

      const allAccounts = await web3Accounts();
      setAccounts(allAccounts);
      
      if (allAccounts.length > 0) {
        setSelectedAccount(allAccounts[0]);
      }
      
      setResults(prev => ({ 
        ...prev, 
        wallet: { success: `Found ${allAccounts.length} account(s)` }
      }));
    } catch (error) {
      setResults(prev => ({ ...prev, wallet: { error: error.message } }));
    } finally {
      setLoading(prev => ({ ...prev, wallet: false }));
    }
  };

  // Connect to node
  const connectToNode = async () => {
    try {
      setLoading(prev => ({ ...prev, node: true }));
      
      const provider = new WsProvider(wsUrl);
      const apiInstance = await ApiPromise.create({ provider });
      
      setApi(apiInstance);
      setIsConnected(true);
      
      const chain = await apiInstance.rpc.system.chain();
      setResults(prev => ({ 
        ...prev, 
        node: { success: `Connected to ${chain}` }
      }));
    } catch (error) {
      setResults(prev => ({ ...prev, node: { error: error.message } }));
      setIsConnected(false);
    } finally {
      setLoading(prev => ({ ...prev, node: false }));
    }
  };

  // Connect to contract
  const connectToContract = async () => {
    if (!api || !contractAddress) {
      setResults(prev => ({ 
        ...prev, 
        contract: { error: 'Please connect to node and enter contract address' }
      }));
      return;
    }

    try {
      setLoading(prev => ({ ...prev, contract: true }));
      
      const contractInstance = new ContractPromise(api, metadata, contractAddress);
      setContract(contractInstance);
      
      setResults(prev => ({ 
        ...prev, 
        contract: { success: `Contract connected at ${contractAddress}` }
      }));
    } catch (error) {
      setResults(prev => ({ ...prev, contract: { error: error.message } }));
    } finally {
      setLoading(prev => ({ ...prev, contract: false }));
    }
  };

  // Generic query function
  const queryContract = async (method, key) => {
    if (!contract || !selectedAccount) {
      setResults(prev => ({ ...prev, [key]: { error: 'Contract or account not connected' } }));
      return;
    }

    try {
      setLoading(prev => ({ ...prev, [key]: true }));
      
      const { result, output } = await contract.query[method](
        selectedAccount.address,
        { gasLimit: -1 }
      );

      if (result.isOk) {
        const value = output?.toHuman();
        setResults(prev => ({ ...prev, [key]: { success: JSON.stringify(value, null, 2) } }));
      } else {
        setResults(prev => ({ ...prev, [key]: { error: result.asErr.toHuman() } }));
      }
    } catch (error) {
      setResults(prev => ({ ...prev, [key]: { error: error.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Generic transaction function
  const sendTransaction = async (method, args, key, value = 0) => {
    if (!contract || !selectedAccount) {
      setResults(prev => ({ ...prev, [key]: { error: 'Contract or account not connected' } }));
      return;
    }

    try {
      setLoading(prev => ({ ...prev, [key]: true }));
      
      const injector = await web3FromAddress(selectedAccount.address);
      
      // Estimate gas
      const { gasRequired } = await contract.query[method](
        selectedAccount.address,
        { gasLimit: -1, value },
        ...args
      );

      // Send transaction
      await contract.tx[method](
        { gasLimit: gasRequired, value },
        ...args
      ).signAndSend(selectedAccount.address, { signer: injector.signer }, ({ status, events }) => {
        if (status.isInBlock) {
          setResults(prev => ({ 
            ...prev, 
            [key]: { success: `Transaction included in block ${status.asInBlock.toHex()}` }
          }));
        }
      });
    } catch (error) {
      setResults(prev => ({ ...prev, [key]: { error: error.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Render result box
  const renderResult = (key) => {
    const result = results[key];
    if (!result) return null;
    
    return (
      <div className={`result-box ${result.success ? 'success' : 'error'}`}>
        {result.success || result.error}
      </div>
    );
  };

  return (
    <div className="container">
      <header>
        <h1>Karera DS</h1>
        <p>Smart Contract Testing Interface</p>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? 'connected' : ''}`}></span>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      {/* Connection Section */}
      <div className="connect-section">
        <h3>Connection Settings</h3>
        
        <div className="form-group">
          <label>WebSocket URL</label>
          <input 
            type="text" 
            value={wsUrl} 
            onChange={(e) => setWsUrl(e.target.value)}
            placeholder="ws://127.0.0.1:9944"
          />
        </div>

        <div className="form-group">
          <label>Contract Address</label>
          <input 
            type="text" 
            value={contractAddress} 
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder="5..."
          />
        </div>

        <div className="button-group">
          <button 
            className="primary" 
            onClick={connectWallet}
            disabled={loading.wallet}
          >
            {loading.wallet ? <span className="loading"></span> : 'Connect Wallet'}
          </button>
          <button 
            className="primary" 
            onClick={connectToNode}
            disabled={loading.node}
          >
            {loading.node ? <span className="loading"></span> : 'Connect to Node'}
          </button>
          <button 
            className="primary" 
            onClick={connectToContract}
            disabled={loading.contract || !isConnected}
          >
            {loading.contract ? <span className="loading"></span> : 'Connect to Contract'}
          </button>
        </div>

        {renderResult('wallet')}
        {renderResult('node')}
        {renderResult('contract')}

        {accounts.length > 0 && (
          <>
            <p className="info-text">Select Account:</p>
            <div className="accounts-list">
              {accounts.map((account, idx) => (
                <button
                  key={idx}
                  className={`account-btn ${selectedAccount?.address === account.address ? 'selected' : ''}`}
                  onClick={() => setSelectedAccount(account)}
                >
                  {account.meta.name || account.address.slice(0, 8) + '...'}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Game Simulation Section */}
      <div className="simulation-section">
        <h2>🏇 Game Simulation</h2>
        <p className="info-text">
          Run a complete horse racing simulation that demonstrates all contract functionality.
        </p>

        <div className="sim-controls">
          <button 
            className="primary sim-btn"
            onClick={runSimulation}
            disabled={simRunning || !contract}
          >
            {simRunning ? (
              <>
                <span className="loading"></span>
                Running... ({simPhase})
              </>
            ) : (
              '▶ Run Full Simulation'
            )}
          </button>
          <button 
            className="secondary sim-btn"
            onClick={resetSimulation}
            disabled={simRunning || !contract}
          >
            🔄 Reset Contract
          </button>
          <button 
            className="secondary sim-btn"
            onClick={clearLogs}
            disabled={simRunning}
          >
            🗑 Clear Logs
          </button>
        </div>

        <div className="sim-phases">
          <div className={`phase-indicator ${simPhase === 'setup' ? 'active' : simPhase !== 'idle' && ['betting', 'racing', 'results'].includes(simPhase) ? 'done' : ''}`}>
            1. Setup
          </div>
          <div className={`phase-indicator ${simPhase === 'betting' ? 'active' : ['racing', 'results'].includes(simPhase) ? 'done' : ''}`}>
            2. Betting
          </div>
          <div className={`phase-indicator ${simPhase === 'racing' ? 'active' : simPhase === 'results' ? 'done' : ''}`}>
            3. Racing
          </div>
          <div className={`phase-indicator ${simPhase === 'results' ? 'active' : ''}`}>
            4. Results
          </div>
        </div>

        <div className="sim-log">
          {simLog.length === 0 ? (
            <div className="log-empty">
              Click "Run Full Simulation" to start the horse racing game simulation.
              <br /><br />
              The simulation will:
              <br />• Add 6 horses to the race
              <br />• Place simulated bets
              <br />• Run the race with random results
              <br />• Calculate and distribute rewards
            </div>
          ) : (
            simLog.map((log, idx) => (
              <div key={idx} className={`log-entry log-${log.type}`}>
                <span className="log-time">[{log.timestamp}]</span>
                <span className="log-msg">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sections">
        {/* Status Section */}
        <div className="section">
          <h2>Status</h2>
          <div className="button-group">
            <button 
              className="secondary" 
              onClick={() => queryContract('getStatus', 'getStatus')}
              disabled={loading.getStatus || !contract}
            >
              {loading.getStatus ? <span className="loading"></span> : 'Get Status'}
            </button>
          </div>
          {renderResult('getStatus')}
          
          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>New Status (0=pending, 1=started, 2=finished)</label>
            <input 
              type="number" 
              value={newStatus} 
              onChange={(e) => setNewStatus(e.target.value)}
              placeholder="0, 1, or 2"
              min="0"
              max="2"
            />
          </div>
          <button 
            className="primary" 
            onClick={() => sendTransaction('setStatus', [parseInt(newStatus)], 'setStatus')}
            disabled={loading.setStatus || !contract}
          >
            {loading.setStatus ? <span className="loading"></span> : 'Set Status'}
          </button>
          {renderResult('setStatus')}
        </div>

        {/* Horses Section */}
        <div className="section">
          <h2>Horses</h2>
          <button 
            className="secondary" 
            onClick={() => queryContract('getHorses', 'getHorses')}
            disabled={loading.getHorses || !contract}
          >
            {loading.getHorses ? <span className="loading"></span> : 'Get All Horses'}
          </button>
          {renderResult('getHorses')}

          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>Horse ID</label>
            <input 
              type="number" 
              value={horseId} 
              onChange={(e) => setHorseId(e.target.value)}
              placeholder="e.g., 1"
            />
          </div>
          <div className="form-group">
            <label>Horse Name</label>
            <input 
              type="text" 
              value={horseName} 
              onChange={(e) => setHorseName(e.target.value)}
              placeholder="e.g., Thunder"
            />
          </div>
          <button 
            className="primary" 
            onClick={() => {
              const nameBytes = Array.from(new TextEncoder().encode(horseName));
              sendTransaction('addHorse', [parseInt(horseId), nameBytes], 'addHorse');
            }}
            disabled={loading.addHorse || !contract}
          >
            {loading.addHorse ? <span className="loading"></span> : 'Add Horse'}
          </button>
          {renderResult('addHorse')}
        </div>

        {/* Bets Section */}
        <div className="section">
          <h2>Bets</h2>
          <button 
            className="secondary" 
            onClick={() => queryContract('getBets', 'getBets')}
            disabled={loading.getBets || !contract}
          >
            {loading.getBets ? <span className="loading"></span> : 'Get All Bets'}
          </button>
          {renderResult('getBets')}

          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>Bet Choice (comma-separated horse IDs)</label>
            <input 
              type="text" 
              value={betChoice} 
              onChange={(e) => setBetChoice(e.target.value)}
              placeholder="e.g., 1,2"
            />
          </div>
          <div className="form-group">
            <label>Bet Amount (in smallest unit)</label>
            <input 
              type="text" 
              value={betAmount} 
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="e.g., 1000000000000"
            />
          </div>
          <button 
            className="primary" 
            onClick={() => {
              const choiceBytes = betChoice.split(',').map(n => parseInt(n.trim()));
              const value = new BN(betAmount || '0');
              sendTransaction('addBet', [choiceBytes], 'addBet', value);
            }}
            disabled={loading.addBet || !contract}
          >
            {loading.addBet ? <span className="loading"></span> : 'Place Bet'}
          </button>
          {renderResult('addBet')}
        </div>

        {/* Winners Section */}
        <div className="section">
          <h2>Winners</h2>
          <button 
            className="secondary" 
            onClick={() => queryContract('getWinners', 'getWinners')}
            disabled={loading.getWinners || !contract}
          >
            {loading.getWinners ? <span className="loading"></span> : 'Get Winners'}
          </button>
          {renderResult('getWinners')}

          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>First Place Horse ID</label>
            <input 
              type="number" 
              value={winnerFirst} 
              onChange={(e) => setWinnerFirst(e.target.value)}
              placeholder="e.g., 1"
            />
          </div>
          <div className="form-group">
            <label>Second Place Horse ID</label>
            <input 
              type="number" 
              value={winnerSecond} 
              onChange={(e) => setWinnerSecond(e.target.value)}
              placeholder="e.g., 2"
            />
          </div>
          <button 
            className="primary" 
            onClick={() => sendTransaction('setWinners', [parseInt(winnerFirst), parseInt(winnerSecond)], 'setWinners')}
            disabled={loading.setWinners || !contract}
          >
            {loading.setWinners ? <span className="loading"></span> : 'Set Winners'}
          </button>
          {renderResult('setWinners')}
        </div>

        {/* Winning Combinations Section */}
        <div className="section">
          <h2>Winning Combinations</h2>
          <button 
            className="secondary" 
            onClick={() => queryContract('getWinningCombinations', 'getWinningCombinations')}
            disabled={loading.getWinningCombinations || !contract}
          >
            {loading.getWinningCombinations ? <span className="loading"></span> : 'Get Combinations'}
          </button>
          {renderResult('getWinningCombinations')}

          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>Add Combination (First, Second)</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="number" 
                id="combFirst"
                placeholder="First"
                style={{ flex: 1 }}
              />
              <input 
                type="number" 
                id="combSecond"
                placeholder="Second"
                style={{ flex: 1 }}
              />
            </div>
          </div>
          <button 
            className="primary" 
            onClick={() => {
              const first = parseInt(document.getElementById('combFirst').value);
              const second = parseInt(document.getElementById('combSecond').value);
              sendTransaction('addWinningCombination', [first, second], 'addWinningCombination');
            }}
            disabled={loading.addWinningCombination || !contract}
          >
            {loading.addWinningCombination ? <span className="loading"></span> : 'Add Combination'}
          </button>
          {renderResult('addWinningCombination')}
        </div>

        {/* Rewards Section */}
        <div className="section">
          <h2>Rewards</h2>
          <button 
            className="secondary" 
            onClick={() => queryContract('getRewards', 'getRewards')}
            disabled={loading.getRewards || !contract}
          >
            {loading.getRewards ? <span className="loading"></span> : 'Get All Rewards'}
          </button>
          {renderResult('getRewards')}

          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>Bettor Address</label>
            <input 
              type="text" 
              value={rewardBettor} 
              onChange={(e) => setRewardBettor(e.target.value)}
              placeholder="5..."
            />
          </div>
          <div className="form-group">
            <label>Reward Amount</label>
            <input 
              type="text" 
              value={rewardAmount} 
              onChange={(e) => setRewardAmount(e.target.value)}
              placeholder="e.g., 1000000000000"
            />
          </div>
          <button 
            className="primary" 
            onClick={() => {
              const amount = new BN(rewardAmount || '0');
              sendTransaction('addReward', [rewardBettor, amount], 'addReward');
            }}
            disabled={loading.addReward || !contract}
          >
            {loading.addReward ? <span className="loading"></span> : 'Add Reward'}
          </button>
          {renderResult('addReward')}
        </div>
      </div>
    </div>
  );
}

export default App;
