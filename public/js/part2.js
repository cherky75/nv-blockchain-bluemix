/* global clear_blocks */
/* global formatMoney */
/* global in_array */
/* global new_block */
/* global formatDate */
/* global nDig */
/* global randStr */
/* global bag */
/* global $ */
var ws = {};
var user = {username: bag.session.username};
var valid_users = ["BANKA","BANKB","BANKC" ];
var panels = [
	{
		name: "dashboard",
		formID: "dashboardFilter",
		tableID: "#dashboardBody",
		filterPrefix: "dashboard_"
	}
];
var lastTx = ''

// =================================================================================
// On Load
// =================================================================================
$(document).on('ready', function() {
	connect_to_server();
	if(user.username && !(bag.session.user_role.toUpperCase() === "auditor".toUpperCase())){
		$("#userField").html(formatUsername(user.username)+ ' ');
	}
	else if(user.username && bag.session.user_role.toUpperCase() === "auditor".toUpperCase())
	{
		$("#userField").html(user.username+ ' ');
	}

	// Customize which panels show up for which user
	$(".nav").hide();
	//console.log("user role", bag.session.user_role);

	// Only show tabs if a user is logged in
	if(user.username) {
		// Display tabs based on user's role
		if(bag.session.user_role && bag.session.user_role.toUpperCase() === "auditor".toUpperCase()) {
			$("#dashboardLink").show();
			$("#AcctTab").hide();
		} else if(user.username) {
			$("#dashboardLink").show();
			$("#transactionLink").show();
		}
	}

	// =================================================================================
	// jQuery UI Events
	// =================================================================================
	$("#generate").click(function(){
		if(user.username){
			$("input[name='RefNumber']").val(randStr(15).toUpperCase());
			$("input[name='OpCode']").val("CRED");
			var today = new Date();
			$("input[name='Date']").val(today.toISOString().substring(0, 10));

			if(user.username=="BANKA"){
				$("input[name='Currency']").val("USD");
			}else if(user.username=="BANKB"){
				$("input[name='Currency']").val("AUD");
			}else if(user.username=="BANKC"){
				$("input[name='Currency']").val("EUR");
			}

			$("input[name='Amount']").val(Math.floor((Math.random() * 100000) + 1000));
			$("input[name='Sender']").val(user.username);

			if(user.username=="BANKA"){
				var val_receivers = ["BANKB","BANKC"]
				$("input[name='Receiver']").val(val_receivers[(Math.floor((Math.random() * 2) + 0))]);
			}else if(user.username=="BANKB"){
				var val_receivers = ["BANKA","BANKC"]
				$("input[name='Receiver']").val(val_receivers[(Math.floor((Math.random() * 2) + 0))]);
			}else if(user.username=="BANKC"){
				var val_receivers = ["BANKA","BANKB"]
				$("input[name='Receiver']").val(val_receivers[(Math.floor((Math.random() * 2) + 0))]);
			}

			var val_OrdCust = ["Bob L","Patricia K","Luke A","John V"]
			$("input[name='OrdCust']").val(val_OrdCust[(Math.floor((Math.random() * 4) + 0))]);

			var val_BenefCust = ["Niel A","Gary W","Leon G","Max T"]
			$("input[name='BenefCust']").val(val_BenefCust[(Math.floor((Math.random() * 4) + 0))]);

			var val_DetCharges = ["BEN","OUR","SHA"]
			$("input[name='DetCharges']").val(val_DetCharges[(Math.floor((Math.random() * 3) + 0))]);
			
			$("#submit").removeAttr("disabled");		
		}

		return false;
	});

	$("#submit").click(function(){
		if(user.username){
			var obj = 	{
							type: "submitTx",
							tx: {
								refNumber: $("input[name='RefNumber']").val(),
								opCode: $("input[name='OpCode']").val(),
								date: $("input[name='Date']").val(),
								currency: $("input[name='Currency']").val(),
								amount: $("input[name='Amount']").val(),
								sender: $("input[name='Sender']").val(),
								receiver: $("input[name='Receiver']").val(),
								ordCust: $("input[name='OrdCust']").val(),
								benefCust: $("input[name='BenefCust']").val(),
								detCharges: $("input[name='DetCharges']").val()
							}
						};

			if(obj.tx && obj.tx.refNumber){
				console.log('creating MT103, sending', obj);
				ws.send(JSON.stringify(obj));
				lastTx = $("input[name='RefNumber']").val()
				$(".panel").hide();
				$("#dashboardPanel").show();

				$("input[name='RefNumber']").val('');
				$("input[name='OpCode']").val('');
				$("input[name='Date']").val('');
				$("input[name='Currency']").val("");
				$("input[name='Amount']").val('');
				$("input[name='Sender']").val('');
				$("input[name='Receiver']").val('');
				$("input[name='OrdCust']").val('');
				$("input[name='BenefCust']").val('');
				$("input[name='DetCharges']").val('');
				$("#submit").prop('disabled', true);

			}
		}
		return false;
	});

	$("#acctRow1").click(function(){
		processFilterTable($("#v1Owner").text().replace(" ", ""),$("#n1Owner").text().replace(" ", ""));
	});

	$("#acctRow2").click(function(){
		processFilterTable($("#v2Owner").text().replace(" ", ""),$("#n2Owner").text().replace(" ", ""));
	});

	$("#homeLink").click(function(){
		console.log('marbles:', bag.marbles);
	});
	
	$("#transactionLink").click(function(){
		
	});
	
	$("#dashboardLink").click(function(){
		if(user.username) {
			ws.send(JSON.stringify({type: "get_nvaccounts", v: 2}));
			ws.send(JSON.stringify({type: "get_txs", v: 2}));
		}
	});
	
	//login events
	$("#whoAmI").click(function(){													//drop down for login
		if($("#loginWrap").is(":visible")){
			$("#loginWrap").fadeOut();
		}
		else{
			$("#loginWrap").fadeIn();
		}
	});

	// Filter the trades whenever the filter modal changes
	$(".dashboard-filter").keyup(function() {
		"use strict";
		console.log("Change in filter detected.");
		processFilterForm(panels[0]);
	});

	
});


// =================================================================================
// Helper Fun
// =================================================================================
function escapeHtml(str) {
	var div = document.createElement('div');
	div.appendChild(document.createTextNode(str));
	return div.innerHTML;
};

// =================================================================================
// Socket Stuff
// =================================================================================
function connect_to_server(){
	var connected = false;
	connect();
		
	function connect(){
		var wsUri = '';
		console.log('protocol', window.location.protocol);
		if(window.location.protocol === 'https:'){
			wsUri = "wss://" + bag.setup.SERVER.EXTURI;
		}
		else{
			wsUri = "ws://" + bag.setup.SERVER.EXTURI;
		}

		ws = new WebSocket(wsUri);
		ws.onopen = function(evt) { onOpen(evt); };
		ws.onclose = function(evt) { onClose(evt); };
		ws.onmessage = function(evt) { onMessage(evt); };
		ws.onerror = function(evt) { onError(evt); };
	}
	
	function onOpen(evt){
		console.log("WS CONNECTED");
		connected = true;
		clear_blocks();
		$("#errorNotificationPanel").fadeOut();
		ws.send(JSON.stringify({type: "chainstats", v:2}));
		if(user.username) {
			ws.send(JSON.stringify({type: "get_nvaccounts", v: 2}));
			ws.send(JSON.stringify({type: "get_txs", v: 2}));
		}

	}

	function onClose(evt){
		console.log("WS DISCONNECTED", evt);
		connected = false;
		setTimeout(function(){ connect(); }, 5000);					//try again one more time, server restarts are quick
	}

	function onMessage(msg){
		try{
			var data = JSON.parse(msg.data);

			if(data.msg === 'allTxs'){
				console.log ("allTxs ****" + data.allTxs);
				var txs = JSON.parse(data.allTxs);
				build_transactions(txs.transactions, null);
			}
			else if(data.msg === 'chainstats'){
				if(data.blockstats.transactions)
				{
					var e = formatDate(data.blockstats.transactions[0].timestamp.seconds * 1000, '%M/%d/%Y &nbsp;%I:%m%P');
					$("#blockdate").html('<span style="color:#fff">TIME</span>&nbsp;&nbsp;' + e + ' UTC');
					var temp = { 
									id: data.blockstats.height, 
									blockstats: data.blockstats
								};
					new_block(temp);
				}									//send to blockchain.js
			}
			else if(data.msg === 'nvAccounts'){		
				//console.log(data)
				
				//Nostro 1
				//console.log("! nvAccounts : ", data.nvAccounts);	
				var nvAccounts = JSON.parse(data.nvAccounts);		
				//console.log("! nostro : ", nvAccounts.nostro);
				if(nvAccounts.nostro){
					$("#n1Holder").html(formatUsername(nvAccounts.nostro[0].accounts[0].holder));
					$("#n1Owner").html(formatUsername(nvAccounts.nostro[0].owner));
					$("#n1Balance").html(formatMoney(nvAccounts.nostro[0].accounts[0].cashBalance, nvAccounts.nostro[0].accounts[0].currency));
					$("#n1Currency").html(nvAccounts.nostro[0].accounts[0].currency);

					if(nvAccounts.nostro[0].accounts[0].cashBalance <= 50000){
						 $("#n1Balance").removeClass("good");
						 $("#n1Balance").addClass("bad");
					}
					else
					{
						 $("#n1Balance").removeClass("bad");
						 $("#n1Balance").addClass("good");
					}

					//Nostro 2					
					$("#n2Holder").html(formatUsername(nvAccounts.nostro[1].accounts[0].holder));
					$("#n2Owner").html(formatUsername(nvAccounts.nostro[1].owner));
					$("#n2Balance").html(formatMoney(nvAccounts.nostro[1].accounts[0].cashBalance, nvAccounts.nostro[1].accounts[0].currency));
					$("#n2Currency").html(nvAccounts.nostro[1].accounts[0].currency);

					if(nvAccounts.nostro[1].accounts[0].cashBalance <= 50000){
						 $("#n2Balance").removeClass("good");
						 $("#n2Balance").addClass("bad");
					}
					else
					{
						 $("#n2Balance").removeClass("bad");
						 $("#n2Balance").addClass("good");
					}
				}
				//console.log("! vostro : ", nvAccounts.vostro);	
				if(nvAccounts.vostro[0].accounts){
					//Vostro 1					
					$("#v1Holder").html(formatUsername(nvAccounts.vostro[0].accounts[0].holder));
					$("#v1Owner").html(formatUsername(nvAccounts.vostro[0].owner));
					$("#v1Balance").html(formatMoney(nvAccounts.vostro[0].accounts[0].cashBalance, nvAccounts.vostro[0].accounts[0].currency));
					$("#v1Currency").html(nvAccounts.vostro[0].accounts[0].currency);

					if(nvAccounts.vostro[0].accounts[0].cashBalance <= 50000){
						 $("#v1Balance").removeClass("good");
						 $("#v1Balance").addClass("bad");
					}
					else
					{
						 $("#v1Balance").removeClass("bad");
						 $("#v1Balance").addClass("good");
					}

					//Vostro 2					
					$("#v2Holder").html(formatUsername(nvAccounts.vostro[0].accounts[1].holder));
					$("#v2Owner").html(formatUsername(nvAccounts.vostro[0].owner));
					$("#v2Balance").html(formatMoney(nvAccounts.vostro[0].accounts[1].cashBalance, nvAccounts.vostro[0].accounts[1].currency));
					$("#v2Currency").html(nvAccounts.vostro[0].accounts[1].currency);

					if(nvAccounts.vostro[0].accounts[1].cashBalance <= 50000){
						 $("#v2Balance").removeClass("good");
						 $("#v2Balance").addClass("bad");
					}
					else
					{
						 $("#v2Balance").removeClass("bad");
						 $("#v2Balance").addClass("good");
					}
				}
			}
			else if(data.msg === 'reset'){						
				if(user.username) {
					ws.send(JSON.stringify({type: "get_nvaccounts", v: 2}));
					ws.send(JSON.stringify({type: "get_txs", v: 2}));
				}
			}
		}
		catch(e){
			console.log('ERROR', e);
			//ws.close();
		}
	}

	function onError(evt){
		console.log('ERROR ', evt);
		if(!connected && bag.e == null){											//don't overwrite an error message
			$("#errorName").html("Warning");
			$("#errorNoticeText").html("Waiting on the node server to open up so we can talk to the blockchain. ");
			$("#errorNoticeText").append("This app is likely still starting up. ");
			$("#errorNoticeText").append("Check the server logs if this message does not go away in 1 minute. ");
			$("#errorNotificationPanel").fadeIn();
		}
	}

	function sendMessage(message){
		console.log("SENT: " + message);
		ws.send(message);
	}
}


// =================================================================================
//	UI Building
// =================================================================================
function build_transactions(txs, panelDesc){
	var html = '';
	bag.txs = txs;					
	// If no panel is given, assume this is the trade panel
	if(!panelDesc) {
		panelDesc = panels[0];
	}
	
	console.log ("txs : " + txs);
	for(var i in txs){
		//console.log('!', txs[i]);
		
		if(excluded(txs[i], filter)) {
			var style = ' ';

			if(txs[i].statusCode == 0)
			{
				style="bad"
			}
			else
			{
				style = "good"
			}


			var direction=''
			if(txs[i].sender == user.username){
				direction = '<i class="fa fa-arrow-circle-right" style="font-size: 18px;color:#2EB9D6;"></i>'
			}
			else {
				direction = '<i class="fa fa-arrow-circle-left" style="font-size: 18px;color:#2EB9D6;"></i>'
			}
			
			// Create a row for each transaction
			html += '<tr>';
			html +=		'<td>' + direction + '</td>';
			html +=		'<td>' + txs[i].refNumber + '</td>';
			html +=		'<td>' + txs[i].opCode + '</td>';
			html +=		'<td>' + txs[i].vDate + '</td>';
			html +=		'<td>' + txs[i].currency + '</td>';
			html +=		'<td>' + formatMoney(txs[i].amount) + '</td>';
			html +=		'<td>' + txs[i].sender + '</td>';
			html +=		'<td>' + txs[i].receiver+ '</td>';
			html +=		'<td>' + txs[i].ordcust + '</td>';
			html +=		'<td>' + txs[i].benefcust + '</td>';
			html +=		'<td>' + txs[i].detcharges + '</td>';
			html +=		'<td class="' + style +'">' + txs[i].statusMsg + '</td>';
			html += '</tr>';

			if(lastTx == txs[i].refNumber){
				if(txs[i].statusCode == 0)
				{
					$("#errorName").html("Warning");
					$("#errorNoticeText").html('<p class="hint">Your transaction has been rejected.</p>');
					$("#errorNotificationPanel").fadeIn();
				}
				else
				{
					$("#notificationPanel").animate({width:'toggle'});
				}
				lastTx = ''
			}
			
		}
	}

	// Placeholder for an empty table
	if(html == '' && panelDesc.name === "dashboard") html = '<tr><td>Nothing here...</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';

	$(panelDesc.tableID).html(html);
}

// =================================================================================
//	Helpers for the filtering of trades
// =================================================================================
var filter = {};

/**
 * Describes all the fields that describe a trade.  Used to create
 * a filter that can be used to control which trades get shown in the
 * table.
 * @type {string[]}
 */
var names = [
	"sender",
	"receiver",
	"ordCust",
	"benefCust",
	"sender2",
	"receiver2"
];

/**
 * Parses the filter forms in the UI into an object for filtering
 * which trades are displayed in the table.
 * @param panelDesc An object describing which panel
 */
function processFilterForm(panelDesc) {
	"use strict";

	var form = document.forms[panelDesc.formID];

	console.log("Processing filter form");

	// Reset the filter parameters
	filter = {};

	// Build the filter based on the form inputs
	for (var i in names) {

		var name = names[i];
		var id = panelDesc.filterPrefix + name;

		if(form[id] && form[id].value !== "") {
			filter[name] = form[id].value;
		}
	}

	console.log("New filter parameters: " + JSON.stringify(filter));
	console.log("Rebuilding paper list");
	build_transactions(bag.txs, panelDesc);
}

function processFilterTable(sender,receiver) {
	"use strict";

	console.log("Processing filter table");

	// Reset the filter parameters
	filter = {};

	// Build the filter based on the form inputs
	filter["receiver"] = receiver;
	filter["sender"] = sender;
	filter["receiver2"] = sender;
	filter["sender2"] = receiver;
	
	console.log("New filter parameters: " + JSON.stringify(filter));
	console.log("Rebuilding paper list");
	build_transactions(bag.txs, null);
}
/**
 * Validates a trade object against a given set of filters.
 * @param paper The object to be validated.
 * @param owner The specific owner in the trade object that you want to validate.
 * @param filter The filter object to validate the trade against.
 * @returns {boolean} True if the trade is valid according to the filter, false otherwise.
 */
function excluded(tx, filter) {
	"use strict";

	if(filter.receiver && filter.receiver!== "" && tx.receiver.toUpperCase().indexOf(filter.receiver.toUpperCase()) == -1 ) {
		if(filter.receiver2 && filter.receiver2!== "" && tx.receiver.toUpperCase().indexOf(filter.receiver2.toUpperCase()) == -1 ) {
			return false
		}
	}

	if(filter.receiver2 && filter.receiver2!== "" && tx.receiver.toUpperCase().indexOf(filter.receiver2.toUpperCase()) == -1 ) {
		if(filter.receiver && filter.receiver!== "" && tx.receiver.toUpperCase().indexOf(filter.receiver.toUpperCase()) == -1 ) {
			return false
		}
	}	

	if(filter.sender && filter.sender!== "" && tx.sender.toUpperCase().indexOf(filter.sender.toUpperCase()) == -1 ) {
		if(filter.sender2 && filter.sender2!== "" && tx.sender.toUpperCase().indexOf(filter.sender2.toUpperCase()) == -1 ) {
			return false
		}
	}

	if(filter.sender2 && filter.sender2!== "" && tx.sender.toUpperCase().indexOf(filter.sender2.toUpperCase()) == -1 ) {
		if(filter.sender && filter.sender!== "" && tx.sender.toUpperCase().indexOf(filter.sender.toUpperCase()) == -1 ) {
			return false
		}
	}	
	
	if(filter.ordCust && filter.ordCust!== "" && tx.ordcust.toUpperCase().indexOf(filter.ordCust.toUpperCase()) == -1 ) return false;

	if(filter.benefCust && filter.benefCust!== "" && tx.benefcust.toUpperCase().indexOf(filter.benefCust.toUpperCase()) == -1 ) return false;


	// Must be a valid trade if we reach this point
	return true;
}