<?php

class Price_Sync_StepResult
{
	/** @var bool */
	public $success;

	/** @var string */
	public $message;

	/** @var array */
	public $data;

	public function __construct($success, $message = '', $data = [])
	{
		$this->success = $success;
		$this->message = $message;
		$this->data = $data;
	}

	public function toArray()
	{
		return [
			'success' => $this->success,
			'message' => $this->message,
			'data' => $this->data,
		];
	}
}
