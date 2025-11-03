var Task = require('../models/task');
var User = require('../models/user');

module.exports = function (router) {

    // GET /tasks
    router.route('/tasks').get(function (req, res) {
        var query = Task.find();

        // Handle where parameter
        if (req.query.where) {
            try {
                var whereParameter = JSON.parse(req.query.where);
                query = query.where(whereParameter);
            } catch (e) {
                return res.status(400).json({
                    message: "Invalid JSON in where parameter",
                    data: {}
                });
            }
        }

        // Handle sort parameter
        if (req.query.sort) {
            try {
                var sortParameter = JSON.parse(req.query.sort);
                query = query.sort(sortParameter);
            } catch (e) {
                return res.status(400).json({
                    message: "Invalid JSON in sort parameter",
                    data: {}
                });
            }
        }

        // Handle select parameter
        if (req.query.select) {
            try {
                var selectParameter = JSON.parse(req.query.select);
                query = query.select(selectParameter);
            } catch (e) {
                return res.status(400).json({
                    message: "Invalid JSON in select parameter",
                    data: {}
                });
            }
        }

        // Handle skip parameter
        if (req.query.skip) {
            var skipParameter = parseInt(req.query.skip);
            if (isNaN(skipParameter) || skipParameter < 0) {
                return res.status(400).json({
                    message: "Invalid JSON in skip parameter",
                    data: {}
                });

            }
            query = query.skip(skipParameter);
        }

        // Handle limit parameter 
        var limitNumber = 100;
        if (req.query.limit) {
            var limitValue = parseInt(req.query.limit);
            if (isNaN(limitValue) || limitValue < 0) {
                return res.status(400).json({
                    message: "Invalid JSON in limit parameter",
                    data: {}
                });
            }
            limitNumber = limitValue;
        }
        query = query.limit(limitNumber);

        // Handle count parameter
        if (req.query.count === 'true') {
            var countQuery = Task.find();

            if (req.query.where) {
                try {
                    var whereConditions = JSON.parse(req.query.where);
                    countQuery = countQuery.where(whereConditions);
                } catch (e) {
                    return res.status(400).json({
                        message: "Invalid JSON in count parameter",
                        data: {}
                    });
                }
            }
            countQuery.countDocuments().exec(function (err, count) {
                if (err) {
                    return res.status(500).json({
                        message: "Server error",
                        data: {}
                    });
                }
                return res.status(200).json({
                    message: "OK",
                    data: count
                });
            });
        } else {
            query.exec(function (err, tasks) {
                if (err) {
                    return res.status(500).json({
                        message: "Server error",
                        data: {}
                    });
                }
                return res.status(200).json({
                    message: "OK",
                    data: tasks
                });
            });
        }
    });


    
    // POST /tasks
    router.route('/tasks').post(function (req, res) {

        // check if all required fields validated
        if (!req.body.name || !req.body.deadline) {
            return res.status(400).json({
                message: "Name and deadline are required.",
                data: {}
            });
        }

        var task = new Task();
        task.name = req.body.name;
        task.description = req.body.description || "";
        task.deadline = req.body.deadline;
        task.completed = req.body.completed || false;
        task.assignedUser = req.body.assignedUser || "";
        task.assignedUserName = req.body.assignedUserName || "unassigned";

        task.save(function (err, savedTask) {
            if (err) {
                return res.status(500).json({
                    message: "Server error",
                    data: {}
                });
            }

            // If task is assigned to a user, update users pending tasks
            if (savedTask.assignedUser && savedTask.assignedUser !== "") {
                User.findById(savedTask.assignedUser, function (err, user) {
                    if (!err && user) {
                        if (user.pendingTasks.indexOf(savedTask._id.toString()) === -1) {
                            user.pendingTasks.push(savedTask._id.toString());
                            user.save(function (err) {
                                if (err) {
                                    console.error("Error updating user's pendingTasks");
                                }
                            });
                        }
                    }
                });
            }

            return res.status(201).json({
                message: "Task created successfully.",
                data: savedTask
            });
        });
    });

    // GET /tasks/:id
    router.route('/tasks/:id').get(function (req, res) {
        var query = Task.findById(req.params.id);

        // Handle select parameter
        if (req.query.select) {
            try {
                var selectParameter = JSON.parse(req.query.select);
                query = query.select(selectParameter);
            } catch (e) {
                return res.status(400).json({
                    message: "Invalid JSON in select parameter",
                    data: {}
                });
            }
        }

        query.exec(function (err, task) {
            if (err) {
                return res.status(500).json({
                    message: "Server Error",
                    data: {}
                });
            }
            if (!task) {
                return res.status(404).json({
                    message: "Not found",
                    data: {}
                });
            }
            return res.status(200).json({
                message: "OK",
                data: task
            });
        });
    });


    // PUT /tasks/:id
    router.route('/tasks/:id').put(function (req, res) {
        // chcek required filed
        if (!req.body.name || !req.body.deadline) {
            return res.status(400).json({
                message: "Name and deadline are required.",
                data: {}
            });
        }

        Task.findById(req.params.id, function (err, task) {
            if (err) {
                return res.status(500).json({
                    message: "Server Error",
                    data: {}
                });
            }
            if (!task) {
                return res.status(404).json({
                    message: "Not Found",
                    data: {}
                });
            }

            var oldAssignedUser = task.assignedUser;
            var newAssignedUser = req.body.assignedUser || "";

            // Update the task
            task.name = req.body.name;
            task.description = req.body.description || "";
            task.deadline = req.body.deadline;
            task.completed = req.body.completed !== undefined ? req.body.completed : false;
            task.assignedUser = newAssignedUser;
            task.assignedUserName = req.body.assignedUserName || "unassigned";

            task.save(function (err, updatedTask) {
                if (err) {
                    return res.status(500).json({
                        message: "Server Error",
                        data: {}
                    });
                }

                // Handle two way reference updats
                var taskId = updatedTask._id.toString();

                // Remove task from old user's pendingTasks if changed
                if (oldAssignedUser && oldAssignedUser !== "" && oldAssignedUser !== newAssignedUser) {
                    User.findById(oldAssignedUser, function (err, user) {
                        if (!err && user) {
                            var index = user.pendingTasks.indexOf(taskId);
                            if (index > -1) {
                                user.pendingTasks.splice(index, 1);
                                user.save(function (err) {
                                    if (err) {
                                        console.error("Error removing task from old user");
                                    }
                                });
                            }
                        }
                    });
                }

                // Add task to new user's pendingTasks if assigned
                if (newAssignedUser && newAssignedUser !== "" && oldAssignedUser !== newAssignedUser) {
                    User.findById(newAssignedUser, function (err, user) {
                        if (!err && user) {
                            if (user.pendingTasks.indexOf(taskId) === -1) {
                                user.pendingTasks.push(taskId);
                                user.save(function (err) {
                                    if (err) {
                                        console.error("Error adding task to new user")
                                    }
                                });
                            }
                        }
                    });
                }

                return res.status(200).json({
                    message: "Task updated successfully.",
                    data: updatedTask
                });
            });
        });
    });

    // DELETE /tasks/:id
    router.route('/tasks/:id').delete(function (req, res) {
        Task.findById(req.params.id, function (err, task) {
            if (err) {
                return res.status(500).json({
                    message: "Server Error",
                    data: {}
                });
            }
            if (!task) {
                return res.status(404).json({
                    message: "Not found",
                    data: {}
                });
            }

            var assignedUser = task.assignedUser;
            var taskId = task._id.toString();

            task.remove(function (err) {
                if (err) {
                    return res.status(500).json({
                        message: "Server Error",
                        data: {}
                    });
                }

                // Remove task from user's pendingTasks if it was assigned
                if (assignedUser && assignedUser !== "") {
                    User.findById(assignedUser, function (err, user) {
                        if (!err && user) {
                            var index = user.pendingTasks.indexOf(taskId);
                            if (index > -1) {
                                user.pendingTasks.splice(index, 1);
                                user.save(function (err) {
                                    if (err) {
                                        console.error("Error removing task from user");
                                    }
                                });
                            }
                        }
                    });
                }

                return res.status(200).json({
                    message: "Task deleted successfully.",
                    data: task
                });
            });
        });
    });

    return router;
};