var User = require('../models/user');
var Task = require('../models/task');

module.exports = function (router) {

    // GET /users
    router.route('/users').get(function (req, res) {
        var query = User.find();

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

        // Handle limit parameter - no default for users
        if (req.query.limit) {
            var limitValue = parseInt(req.query.limit);
            if (isNaN(limitValue) || limitValue < 0) {
                return res.status(400).json({
                    message: "Invalid JSON in limit parameter",
                    data: {}
                });
            }
            query = query.limit(limitValue);
        }

        // Handle count parameter
        if (req.query.count === 'true') {
            var countQuery = User.find();

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
            query.exec(function (err, users) {
                if (err) {
                    return res.status(500).json({
                        message: "Server error",
                        data: {}
                    });
                }
                return res.status(200).json({
                    message: "OK",
                    data: users
                });
            });
        }
    });

    // POST /users
    router.route('/users').post(function (req, res) {

        // check if all required fields validated
        if (!req.body.name || !req.body.email) {
            return res.status(400).json({
                message: "Name and email are required.",
                data: {}
            });
        }

        // Check if email already exists
        User.findOne({ email: req.body.email }, function (err, existingUser) {
            if (err) {
                return res.status(500).json({
                    message: "Server error",
                    data: {}
                });
            }
            if (existingUser) {
                return res.status(400).json({
                    message: "Email already exists.",
                    data: {}
                });
            }

            var user = new User();
            user.name = req.body.name;
            user.email = req.body.email;
            user.pendingTasks = req.body.pendingTasks || [];

            user.save(function (err, savedUser) {
                if (err) {
                    return res.status(500).json({
                        message: "Server error",
                        data: {}
                    });
                }

                return res.status(201).json({
                    message: "User created successfully.",
                    data: savedUser
                });
            });
        });
    });

    // GET /users/:id
    router.route('/users/:id').get(function (req, res) {
        var query = User.findById(req.params.id);

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

        query.exec(function (err, user) {
            if (err) {
                return res.status(500).json({
                    message: "Server Error",
                    data: {}
                });
            }
            if (!user) {
                return res.status(404).json({
                    message: "Not found",
                    data: {}
                });
            }
            return res.status(200).json({
                message: "OK",
                data: user
            });
        });
    });

    // PUT /users/:id
    router.route('/users/:id').put(function (req, res) {
        // check required filed
        if (!req.body.name || !req.body.email) {
            return res.status(400).json({
                message: "Name and email are required.",
                data: {}
            });
        }

        User.findById(req.params.id, function (err, user) {
            if (err) {
                return res.status(500).json({
                    message: "Server Error",
                    data: {}
                });
            }
            if (!user) {
                return res.status(404).json({
                    message: "Not Found",
                    data: {}
                });
            }

            // Check if new email already exists (and it's not the same user)
            User.findOne({ email: req.body.email, _id: { $ne: req.params.id } }, function (err, emailCheck) {
                if (err) {
                    return res.status(500).json({
                        message: "Server Error",
                        data: {}
                    });
                }
                if (emailCheck) {
                    return res.status(400).json({
                        message: "Email already exists.",
                        data: {}
                    });
                }

                var oldPendingTasks = user.pendingTasks || [];
                var newPendingTasks = req.body.pendingTasks || [];

                // Ensure they are arrays
                if (!Array.isArray(oldPendingTasks)) {
                    oldPendingTasks = [];
                }
                if (!Array.isArray(newPendingTasks)) {
                    newPendingTasks = [];
                }

                // Update the user
                user.name = req.body.name;
                user.email = req.body.email;
                user.pendingTasks = newPendingTasks;

                user.save(function (err, updatedUser) {
                    if (err) {
                        return res.status(500).json({
                            message: "Server Error",
                            data: {}
                        });
                    }

                    // Handle two way reference updates
                    // Remove tasks that were removed from pendingTasks
                    oldPendingTasks.forEach(function (taskId) {
                        if (newPendingTasks.indexOf(taskId) === -1) {
                            Task.findByIdAndUpdate(taskId, {
                                assignedUser: "",
                                assignedUserName: "unassigned"
                            }, function (err) {
                                if (err) {
                                    console.error("Error unassigning task");
                                }
                            });
                        }
                    });

                    // Add tasks that were added to pendingTasks
                    newPendingTasks.forEach(function (taskId) {
                        if (oldPendingTasks.indexOf(taskId) === -1) {
                            Task.findByIdAndUpdate(taskId, {
                                assignedUser: updatedUser._id.toString(),
                                assignedUserName: updatedUser.name
                            }, function (err) {
                                if (err) {
                                    console.error("Error assigning task");
                                }
                            });
                        }
                    });

                    return res.status(200).json({
                        message: "User updated successfully.",
                        data: updatedUser
                    });
                });
            });
        });
    });

    // DELETE /users/:id
    router.route('/users/:id').delete(function (req, res) {
        User.findById(req.params.id, function (err, user) {
            if (err) {
                return res.status(500).json({
                    message: "Server Error",
                    data: {}
                });
            }
            if (!user) {
                return res.status(404).json({
                    message: "Not found",
                    data: {}
                });
            }

            var pendingTasks = user.pendingTasks || [];

            user.remove(function (err) {
                if (err) {
                    return res.status(500).json({
                        message: "Server Error",
                        data: {}
                    });
                }

                // Unassign all tasks from this user
                if (pendingTasks.length > 0) {
                    pendingTasks.forEach(function (taskId) {
                        Task.findByIdAndUpdate(taskId, {
                            assignedUser: "",
                            assignedUserName: "unassigned"
                        }, function (err) {
                            if (err) {
                                console.error("Error unassigning task");
                            }
                        });
                    });
                }

                return res.status(200).json({
                    message: "User deleted successfully.",
                    data: user
                });
            });
        });
    });

    return router;
};