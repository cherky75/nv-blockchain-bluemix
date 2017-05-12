// ==================================
// Part 2 - incoming messages, look for type
// ==================================
var ibc = {};
var chaincode = {};
var async = require('async');

module.exports.setup = function(sdk, cc){
	ibc = sdk;
	chaincode = cc;
};

module.exports.process_msg = function(ws, data, finInst){
	
	
	if(data.type == 'chainstats'){
		console.log('Chainstats msg');
		ibc.chain_stats(cb_chainstats);
	}
	else if(data.type == 'get_nvaccounts'){
		console.log('Get Nostro Vostro Accounts', finInst );
		chaincode.query.read(['getNVAccounts', finInst], cb_got_nv_accounts);
	}
	else if(data.type == 'submitTx'){
		console.log('Submit Transaction', data);
		if(data.tx){
			chaincode.invoke.submitTx([data.tx.refNumber,data.tx.opCode,data.tx.date,data.tx.currency,data.tx.amount,finInst,data.tx.receiver,data.tx.ordCust,data.tx.benefCust,data.tx.detCharges], cb_invoked);				//create a new paper
		}
	}
	else if(data.type == 'get_txs'){
		console.log('Get Transactions', finInst);
		chaincode.query.read(['getTxs', finInst], cb_got_txs);
	}
	
	function cb_got_txs(e, allTxs){
		if(e != null){
			console.log('Get Transactions error', e);
		}
		else{
			console.log("allTxs ************", allTxs);
			sendMsg({msg: 'allTxs', allTxs: allTxs});
		}
	}
	
	function cb_got_nv_accounts(e,  nvAccounts){
		if(e != null){
			console.log('Got NV Accounts error', e);
		}
		else{
			console.log("nvAccounts ************", nvAccounts);
			sendMsg({msg: 'nvAccounts', nvAccounts: nvAccounts});
		}
	}
	
	function cb_invoked(e, a){
		console.log('response: ', e, a);
	}
	
	//call back for getting the blockchain stats, lets get the block height now
	var chain_stats = {};
	function cb_chainstats(e, stats){
		chain_stats = stats;
		if(stats && stats.height){
			var list = [];
			for(var i = stats.height - 1; i >= 1; i--){										//create a list of heights we need
				list.push(i);
				if(list.length >= 8) break;
			}
			list.reverse();																//flip it so order is correct in UI
			console.log(list);
			async.eachLimit(list, 1, function(key, cb) {								//iter through each one, and send it
				ibc.block_stats(key, function(e, stats){
					if(e == null){
						stats.height = key;
						sendMsg({msg: 'chainstats', e: e, chainstats: chain_stats, blockstats: stats});
					}
					cb(null);
				});
			}, function() {
			});
		}
	}

	//call back for getting a block's stats, lets send the chain/block stats
	function cb_blockstats(e, stats){
		if(chain_stats.height) stats.height = chain_stats.height - 1;
		sendMsg({msg: 'chainstats', e: e, chainstats: chain_stats, blockstats: stats});
	}
	

	//send a message, socket might be closed...
	function sendMsg(json){
		if(ws){
			try{
				ws.send(JSON.stringify(json));
			}
			catch(e){
				console.log('error ws', e);
			}
		}
	}
};
