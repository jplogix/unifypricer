jQuery(document).ready(function($) {
	var currentStep = -1;
	var connectionInProgress = false;

	// Auto-start connection if token is present
	if (priceSyncConnector.token && priceSyncConnector.token.length > 0) {
		$('#start-connection').on('click', startConnection);
	}

	function startConnection() {
		if (connectionInProgress) {
			return;
		}

		connectionInProgress = true;
		$('#connector-intro').hide();
		$('#connector-progress').show();

		launchStep(0);
	}

	function launchStep(stepIndex) {
		currentStep = stepIndex;
		updateProgress();

		$.ajax({
			type: 'POST',
			url: priceSyncConnector.adminUrl,
			data: {
				action: 'price_sync_connect',
				step: currentStep,
				token: priceSyncConnector.token
			},
			success: handleStepResponse,
			error: function(xhr, status, error) {
				showError('Connection error: ' + error);
			}
		});
	}

	function handleStepResponse(response) {
		var $stepElement = $('#step-' + currentStep);

		if (!response.success) {
			$stepElement.removeClass('step-in-progress').addClass('step-failed');
			showError(response.message || 'Connection failed. Please try again.');
			return;
		}

		// Step succeeded
		$stepElement.removeClass('step-in-progress').addClass('step-complete');

		// Check if this was the last step
		if (currentStep + 1 >= priceSyncConnector.stepCount) {
			showSuccess(response.message, response.data);
			return;
		}

		// Launch next step
		launchStep(currentStep + 1);
	}

	function updateProgress() {
		for (var i = 0; i < priceSyncConnector.stepCount; i++) {
			var $step = $('#step-' + i);
			$step.removeClass('step-in-progress step-complete step-failed');

			if (i < currentStep) {
				$step.addClass('step-complete');
			} else if (i === currentStep) {
				$step.addClass('step-in-progress');
			} else {
				$step.addClass('step-pending');
			}
		}
	}

	function showError(message) {
		connectionInProgress = false;
		var $result = $('#connection-result');
		$result.html('<div class="notice notice-error inline"><p><strong>' + message + '</strong></p></div>');

		// Add retry button
		$result.append('<p><button type="button" class="button button-secondary" onclick="location.reload()">Try Again</button></p>');
	}

	function showSuccess(message, data) {
		var $result = $('#connection-result');
		$result.html('<div class="notice notice-success inline"><p><strong>' + message + '</strong></p></div>');

		// If redirect URL provided, show link
		if (data && data.redirect_url) {
			$result.append('<p><a href="' + data.redirect_url + '" class="button button-primary" target="_blank">Open Price Sync Dashboard</a></p>');
		}

		// Auto-close after 3 seconds if in popup
		if (window.opener) {
			setTimeout(function() {
				if (window.opener && !window.opener.closed) {
					window.opener.postMessage({
						type: 'price-sync-success',
						data: data
					}, '*');
				}
				window.close();
			}, 2000);
		}
	}
});
