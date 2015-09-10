# Copyright (c) 2015, Kinvey, Inc. All rights reserved.
#
# This software is licensed to you under the Kinvey terms of service located at
# http://www.kinvey.com/terms-of-use. By downloading, accessing and/or using this
# software, you hereby accept such terms of service  (and any agreement referenced
# therein) and agree that you have read, understand and agree to be bound by such
# terms of service and are of legal age to agree to such terms with Kinvey.
#
# This software contains valuable confidential and proprietary information of
# KINVEY, INC and is subject to applicable licensing agreements.
# Unauthorized reproduction, transmission or distribution of this file and its
# contents is a violation of applicable laws.

entityHelper = require './modules/entity'
domain = require 'domain'

module.exports = do ->
  registeredCollections = {}
  dataRegistrationOperators = [
    'onInsert'
    'onDeleteById'
    'onDeleteAll'
    'onDeleteByQuery'
    'onUpdate'
    'onGetById'
    'onGetAll'
    'onGetByQuery'
    'onGetCount'
    'onGetCountWithQuery'
  ]

  class Collection
    constructor: (collectionName) ->
      @eventMap = {}

    register: (dataOp, functionToExecute) ->
      unless dataOp? and dataOp in dataRegistrationOperators
        throw new Error 'Operation not permitted'

      @eventMap[dataOp] = functionToExecute

    onInsert: (functionToExecute) ->
      @register 'onInsert', functionToExecute

    onDeleteById: (functionToExecute) ->
      @register 'onDeleteById', functionToExecute

    onDeleteAll: (functionToExecute) ->
      @register 'onDeleteAll', functionToExecute

    onDeleteByQuery: (functionToExecute) ->
      @register 'onDeleteByQuery', functionToExecute

    onUpdate: (functionToExecute) ->
      @register 'onUpdate', functionToExecute

    onGetById: (functionToExecute) ->
      @register 'onGetById', functionToExecute

    onGetAll: (functionToExecute) ->
      @register 'onGetAll', functionToExecute

    onGetByQuery: (functionToExecute) ->
      @register 'onGetByQuery', functionToExecute

    onGetCount: (functionToExecute) ->
      @register 'onGetCount', functionToExecute

    onGetCountWithQuery: (functionToExecute) ->
      @register 'onGetCountWithQuery', functionToExecute

    resolve: (dataOp) ->
      unless @eventMap[dataOp]?
        return new Error 'This data operation is not registered'

      return @eventMap[dataOp]

  collection = (collectionName) ->

    unless registeredCollections[collectionName]?
      registeredCollections[collectionName] = new Collection(collectionName)

    return registeredCollections[collectionName]

  initCompletionHandler = (task, callback) ->

    environmentId = task.appMetadata._id

    convertToError = (body) ->

      errorResult = new Error (body?.message or body.toString())
      errorResult.debugMessage = body.toString()
      errorResult.metadata = metadata
      if body?.unhandledException is true
        errorResult.metadata.unhandled = true

      return errorResult

    completionHandler = (entity) ->
      console.log "In completion handler"
      entityParser = entityHelper environmentId

      responseCallback = callback
      result = task.response
      result.body = entity
      methods = {}

      created = ->
        result.statusCode = 201
        return methods

      accepted = ->
        result.statusCode = 202
        return methods

      ok = ->
        result.statusCode = 200
        return methods

      notFound = ->
        result.statusCode = 404
        return methods

      badRequest = ->
        result.statusCode = 400
        return methods

      unauthorized = ->
        result.statusCode = 401
        return methods

      forbidden = ->
        result.statusCode = 403
        return methods

      notAllowed = ->
        result.statusCode = 405
        return methods

      notImplemented = ->
        result.statusCode = 501
        return methods

      runtimeError = ->
        result.statusCode = 550
        return methods

      done = ->
        unless result.statusCode?
          result.statusCode = 200

        if result.statusCode < 400 and entityParser.isKinveyEntity(entity) is false
          if entity.constructor isnt Array
            entity = entityParser.entity entity

        result.continue = false
        task.request = result
        responseCallback null, task

      next = ->
        console.log "In next handler"
        unless result.statusCode?
          result.statusCode = 200
        console.log "About to parse entity(s)"
        result.body = JSON.stringify entity
        #if result.statusCode < 400 and entityParser.isKinveyEntity(entity) is false

          #if entity.constructor isnt Array
          #  entity = entityParser.entity entity


        result.continue = true

        if result.statusCode >= 400
          console.log "About to parse error"
          convertToError result.body

        task.request = result
        console.log "About to process callback"
        responseCallback null, task

      methods =
        created: created
        accepted: accepted
        ok: ok
        done: done
        next: next
        notFound: notFound
        badRequest: badRequest
        unauthorized: unauthorized
        forbidden: forbidden
        notAllowed: notAllowed
        notImplemented: notImplemented
        runtimeError: runtimeError

      return methods

    return completionHandler

  process = (task, modules, callback) ->
    console.log "Processing entry"
    console.log task
    unless task.collectionName?
      return callback new Error "CollectionName not found"

    collectionToProcess = collection task.collectionName
    dataOp = ''
    console.log "Generating completion handler"
    completionHandler = initCompletionHandler task, callback

    try
      task.request.body = JSON.parse task.request.body
    catch e

    console.log "Checking dataop"
    if task.method is 'POST'
      console.log "DataOp is insert"
      dataOp = 'onInsert'
    else if task.method is 'PUT'
      console.log "DataOp is update"
      dataOp = 'onUpdate'
    else if task.method is 'GET' and task.endpoint isnt '_count'
      console.log "DataOp is GET"
      if task.request?.entityId?
        console.log "GetById"
        dataOp = 'onGetById'
      else if task.query?
        console.log "getByQuery"
        dataOp = 'onGetByQuery'
      else
        console.log "GetAll"
        dataOp = 'onGetAll'
    else if task.method is 'GET' and task.endpoint is '_count'
      if task.query?
        dataOp = 'onGetCountWithQuery'
      else
        dataOp = 'onGetCount'
    else if task.method is 'DELETE'
      console.log "DataOp is Delete"
      if task.request.entityId?
        dataOp = 'onDeleteById'
      else if task.query?
        dataOp = 'onDeleteByQuery'
      else
        dataOp = 'onDeleteAll'
    else
      console.log "Problem - no dataOp"
      return callback new Error "Cannot determine data operation"

    console.log "Getting handler function"
    operationHandler = collectionToProcess.resolve dataOp
    console.log "Handler is #{typeof operationHandler}"

    if operationHandler instanceof Error
      return callback(convertToError operationHandler)

    # TODO Need to handle runtime errors/unhandled exceptions - or do we?
    console.log "Binding domain for error handling"
    taskDomain = domain.create()

    taskDomain.on 'error', (err) =>
      err.metadata = {}
      err.metadata.unhandled = true
      err.taskId = task.taskId
      err.requestId = task.requestId
      return callback(confvertToError operationHandler)

    domainBoundOperationHandler = taskDomain.bind operationHandler

    console.log "about to execute function"
    domainBoundOperationHandler task.request, completionHandler

  obj =
    collection: collection
    process: process


  return obj
